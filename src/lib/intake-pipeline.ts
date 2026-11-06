import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { evaluateB2BShield, B2BShieldResult } from "./qualification-shield";
import { findExistingDuplicate, mergeLeadIntoExisting, cleanLeadCategory } from "./dedup";
import { logCandidateEvent } from "./events";
import { evaluateModularLeadScore } from "./evaluator";

/**
 * Universal Production Lead Intake Pipeline
 * Single point of entry for ALL lead generation channels.
 * Guarantees that:
 * 1. Leads without valid callable phones are automatically diverted to rejected_leads.
 * 2. Multi-touch or duplicate inquiries are atomically merged into existing accounts.
 * 3. Scraper search queries and typos are strictly normalized to canonical B2B taxonomy.
 * 4. Zero em dashes used anywhere in code or telemetry.
 */

export interface RawLeadInput {
  businessName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  industry?: string | null;
  category?: string | null;
  projectType?: string | null;
  workstationCount?: number | null;
  projectTimeline?: string | null;
  estimatedBudget?: string | null;
  hasFloorPlan?: boolean;
  notes?: string | null;
  sourceType?: string | null;
  leadSource?: string | null;
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  rating?: string | number | null;
  reviewCount?: number | null;
  searchId?: string | null;
  qualificationStage?: string | null;
}

export interface IngestionContext {
  channel: "discovery_sweep" | "ad_webhook" | "csv_import" | "manual_entry" | "api_sync";
  actor?: string;
  autoLogEvent?: boolean;
}

export type IngestResult =
  | {
      success: true;
      action: "CREATED";
      candidateId: string;
      businessName: string;
      phone: string;
      category: string;
      city: string;
      leadTier: string;
      totalScore: number;
    }
  | {
      success: true;
      action: "MERGED";
      candidateId: string;
      businessName: string;
      phone: string;
      mergedTouchpoint: string;
    }
  | {
      success: false;
      action: "REJECTED";
      rejectedId: string;
      rejectionReason: string;
      details: string;
    };

/**
 * Master Intake Gatekeeper
 * Evaluates, sanitizes, deduplicates, and persists or diverts any incoming lead.
 */
export async function ingestCandidateLead(
  rawInput: RawLeadInput,
  context: IngestionContext
): Promise<IngestResult> {
  const actor = context.actor || "Intake Engine";
  const channel = context.channel;

  // 1. EVALUATE THROUGH MASTER B2B PRE-INGESTION SHIELD
  const shieldResult: B2BShieldResult = evaluateB2BShield({
    businessName: rawInput.businessName,
    category: rawInput.category || rawInput.industry,
    projectType: rawInput.projectType,
    notes: rawInput.notes,
    phone: rawInput.phone,
    address: rawInput.address,
    city: rawInput.city,
  });

  // Rejection Gate: Divert invalid phones, residential queries, aggregators
  if (!shieldResult.passed) {
    const rejectedId = `rej_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reason = shieldResult.rejectionReason;
    const details = shieldResult.details;

    await db.insert(rejectedLeads).values({
      id: rejectedId,
      businessName: shieldResult.cleanedBusinessName || rawInput.businessName || "Unnamed Business",
      phone: rawInput.phone || "-",
      city: rawInput.city || "Ahmedabad",
      leadSource: rawInput.leadSource || channel,
      category: shieldResult.cleanedCategory || "Residential Decorator",
      rejectionReason: reason,
      notes: details,
      rawPayload: {
        context,
        rawInput,
        details,
        rejectedAt: new Date().toISOString(),
      },
    });

    return {
      success: false,
      action: "REJECTED",
      rejectedId,
      rejectionReason: reason,
      details,
    };
  }

  // 2. ATOMIC IDENTITY RESOLUTION & DEDUPLICATION LOOKUP
  const duplicateMatch = await findExistingDuplicate({
    phone: shieldResult.formattedPhone,
    businessName: shieldResult.cleanedBusinessName,
    website: rawInput.website,
  });

  if (duplicateMatch) {
    const existing = duplicateMatch.candidate;
    const matchType = duplicateMatch.matchType;
    const touchDetail = rawInput.notes
      ? `${rawInput.notes}${rawInput.projectType ? ` (${rawInput.projectType})` : ""}`
      : rawInput.projectType
      ? `${rawInput.projectType} inquiry via ${channel}`
      : `Re-engaged via ${channel}`;

    await mergeLeadIntoExisting({
      existingCandidate: existing,
      incomingLead: {
        businessName: shieldResult.cleanedBusinessName,
        contactPerson: rawInput.contactPerson || undefined,
        phone: shieldResult.formattedPhone,
        email: rawInput.email || undefined,
        website: rawInput.website || undefined,
        address: shieldResult.cleanedAddress || undefined,
        city: shieldResult.normalizedCity,
        category: shieldResult.cleanedCategory,
        notes: touchDetail,
        leadSource: rawInput.leadSource || channel,
        campaignName: rawInput.campaignName || undefined,
      },
      channel,
      matchType,
    });

    return {
      success: true,
      action: "MERGED",
      candidateId: existing.id,
      businessName: existing.businessName,
      phone: existing.phone,
      mergedTouchpoint: `[Touchpoint (${matchType})]: ${touchDetail}`,
    };
  }

  // 3. CANONICAL B2B EVALUATION & SCORING
  const scoreResult = evaluateModularLeadScore({
    businessName: shieldResult.cleanedBusinessName,
    category: shieldResult.cleanedCategory,
    city: shieldResult.normalizedCity,
    phone: shieldResult.formattedPhone,
    email: rawInput.email || null,
    website: rawInput.website || null,
    rating: typeof rawInput.rating === "string" ? parseFloat(rawInput.rating) || null : rawInput.rating || null,
    reviewCount: rawInput.reviewCount || null,
    hasCommercialFocus: true,
    whatsappAvailable: shieldResult.isMobile,
  });

  // 4. ATOMIC CREATION IN DATABASE (GUARANTEED CLEAN & CALLABLE)
  const candidateId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const finalCategory = cleanLeadCategory(shieldResult.cleanedCategory);

  await db.insert(candidates).values({
    id: candidateId,
    searchId: rawInput.searchId || null,
    businessName: shieldResult.cleanedBusinessName,
    contactPerson: rawInput.contactPerson || null,
    industry: finalCategory, // Strictly canonical B2B category
    category: finalCategory, // Strictly canonical B2B category
    city: shieldResult.normalizedCity,
    state: rawInput.state || "Gujarat",
    address: shieldResult.cleanedAddress || null,
    phone: shieldResult.formattedPhone, // Strictly valid E.164 / STD formatted
    email: rawInput.email || null,
    website: rawInput.website || null,
    rating: rawInput.rating !== undefined && rawInput.rating !== null ? rawInput.rating.toString() : null,
    reviewCount: rawInput.reviewCount || null,
    sourceType: rawInput.sourceType || channel,
    sourceUrl: null,
    leadSource: rawInput.leadSource || channel,
    campaignName: rawInput.campaignName || null,
    adsetName: rawInput.adsetName || null,
    adName: rawInput.adName || null,
    utmSource: rawInput.utmSource || null,
    utmMedium: rawInput.utmMedium || null,
    utmCampaign: rawInput.utmCampaign || null,
    projectType: rawInput.projectType || "Modular Workstations",
    workstationCount: rawInput.workstationCount || null,
    projectTimeline: rawInput.projectTimeline || "1-2 months",
    hasFloorPlan: Boolean(rawInput.hasFloorPlan),
    estimatedBudget: rawInput.estimatedBudget || null,
    qualificationStage: rawInput.qualificationStage || "NEW",
    operatorNotes: rawInput.notes || "Inbound prospect queued for telecalling outreach.",
    firstContactedAt: null,
    lastContactedAt: null,
    totalScore: scoreResult.totalScore,
    leadTier: scoreResult.leadTier,
    fitScore: scoreResult.fitScore,
    scaleScore: scoreResult.scaleScore,
    activityScore: scoreResult.activityScore,
    accessibilityScore: scoreResult.accessibilityScore,
    synergyScore: scoreResult.synergyScore,
    reasoning: scoreResult.reasoning,
    hasCommercialFocus: true,
    whatsappAvailable: shieldResult.isMobile,
    isDummyPhone: false,
    enrichmentStatus: "NONE",
    swatchBoxStatus: "NONE",
  });

  // 5. CHRONOLOGICAL AUDIT TIMELINE EVENT
  await logCandidateEvent({
    candidateId,
    eventType: "LEAD_CAPTURED",
    title: `Inbound Lead Ingested (${channel})`,
    description: `Auto-qualified ${scoreResult.leadTier} lead via ${channel}. Validated callable phone ${shieldResult.formattedPhone}.`,
    channel: "SYSTEM",
    actor,
  });

  return {
    success: true,
    action: "CREATED",
    candidateId,
    businessName: shieldResult.cleanedBusinessName,
    phone: shieldResult.formattedPhone,
    category: finalCategory,
    city: shieldResult.normalizedCity,
    leadTier: scoreResult.leadTier,
    totalScore: scoreResult.totalScore,
  };
}
