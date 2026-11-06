import { db } from "@/db";
import { candidates, candidateEvents } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { logCandidateEvent } from "./events";

/**
 * Deduplication Engine & Identity Resolution
 * For D'furn Modular Systems Lead Pipeline
 * Strictly zero em dashes.
 */

// Common generic platforms to ignore during domain-level deduplication
const IGNORED_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "justdial.com",
  "indiamart.com",
  "sulekha.com",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "bit.ly",
  "linktr.ee",
]);

/**
 * Normalizes phone numbers to standard searchable digit strings.
 * For mobile numbers: extracts the core 10 digits (e.g. '9563200100').
 * For Ahmedabad landlines: extracts STD + number (e.g. '07926470050').
 */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");

  if (digits.length < 8) return "";

  // Mobile number (10-12 digits ending in 10 mobile digits starting with 6-9)
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]/.test(last10)) {
      return last10;
    }
  }

  // Ahmedabad Landline (079 + 8 digits)
  if (digits.includes("079") || digits.startsWith("79") || digits.startsWith("9179")) {
    const idx = digits.indexOf("79");
    if (idx !== -1 && digits.length >= idx + 10) {
      return `079${digits.slice(idx + 2, idx + 10)}`;
    }
  }

  // Generic digits fallback
  return digits.slice(-10);
}

/**
 * Extracts and cleans the root domain from a website URL.
 * Returns null if domain is invalid or on the public aggregator blocklist.
 */
export function normalizeDomain(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  let target = url.trim().toLowerCase();
  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    target = `https://${target}`;
  }

  try {
    const parsed = new URL(target);
    let host = parsed.hostname.replace(/^www\./, "");
    if (IGNORED_DOMAINS.has(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Normalizes company names for fuzzy identity matching.
 * Removes legal entities (Pvt Ltd, LLP), noise words, and punctuation.
 */
export function normalizeFirmName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llp|inc|co|company|enterprises|associates|group)\b/gi, "")
    .replace(/\b(architects?|interiors?|designers?|design|studio|consultants?|creations?|projects?)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export interface DuplicateMatchResult {
  candidate: any;
  matchType: "PHONE" | "DOMAIN" | "FIRM_NAME";
  matchedValue: string;
}

/**
 * Checks the database for any existing candidate matching phone, domain, or company name.
 */
export async function findExistingDuplicate(lead: {
  phone?: string | null;
  businessName?: string | null;
  website?: string | null;
}): Promise<DuplicateMatchResult | null> {
  const normPhone = normalizePhoneDigits(lead.phone);
  const normDom = normalizeDomain(lead.website);
  const normFirm = normalizeFirmName(lead.businessName);

  // 1. Phone match check (highest accuracy)
  if (normPhone && normPhone.length >= 8) {
    // Search candidates where phone contains these digits
    const phoneCandidates = await db
      .select()
      .from(candidates)
      .where(sql`REPLACE(REPLACE(REPLACE(REPLACE(${candidates.phone}, ' ', ''), '-', ''), '+91', ''), '+', '') LIKE ${'%' + normPhone}`);

    if (phoneCandidates.length > 0) {
      return {
        candidate: phoneCandidates[0],
        matchType: "PHONE",
        matchedValue: normPhone,
      };
    }
  }

  // 2. Website domain match check
  if (normDom) {
    const domainCandidates = await db
      .select()
      .from(candidates)
      .where(sql`LOWER(${candidates.website}) LIKE ${'%' + normDom + '%'}`);

    if (domainCandidates.length > 0) {
      return {
        candidate: domainCandidates[0],
        matchType: "DOMAIN",
        matchedValue: normDom,
      };
    }
  }

  // 3. Exact normalized firm name match check
  if (normFirm && normFirm.length >= 4) {
    const allCandidates = await db
      .select({
        id: candidates.id,
        businessName: candidates.businessName,
        phone: candidates.phone,
        qualificationStage: candidates.qualificationStage,
        leadSource: candidates.leadSource,
        operatorNotes: candidates.operatorNotes,
      })
      .from(candidates);

    const matched = allCandidates.find((c) => {
      const cNorm = normalizeFirmName(c.businessName);
      return cNorm && cNorm.length >= 4 && cNorm === normFirm;
    });

    if (matched) {
      return {
        candidate: matched,
        matchType: "FIRM_NAME",
        matchedValue: normFirm,
      };
    }
  }

  return null;
}

/**
 * Updates an existing lead with a new touchpoint instead of creating a duplicate row.
 * Preserves the sales operator's qualification stage and appends audit telemetry.
 */
export async function mergeLeadIntoExisting(params: {
  existingCandidate: any;
  incomingLead: {
    businessName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    city?: string;
    category?: string;
    notes?: string;
    leadSource?: string;
    campaignName?: string;
  };
  channel: string;
  matchType: string;
}) {
  const { existingCandidate, incomingLead, channel, matchType } = params;

  // Combine lead sources if new
  const currentSources = (existingCandidate.leadSource || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const newSource = incomingLead.leadSource || channel;
  if (!currentSources.includes(newSource)) {
    currentSources.push(newSource);
  }

  // Build notes addition
  const notePrefix = existingCandidate.operatorNotes ? `${existingCandidate.operatorNotes} · ` : "";
  const touchDetails = incomingLead.notes || `Re-encountered via ${channel}`;
  const updatedNotes = `${notePrefix}[Touchpoint (${matchType})]: ${touchDetails}`;

  await db
    .update(candidates)
    .set({
      leadSource: currentSources.join(", "),
      campaignName: incomingLead.campaignName || existingCandidate.campaignName,
      contactPerson: existingCandidate.contactPerson || incomingLead.contactPerson,
      email: existingCandidate.email || incomingLead.email,
      website: existingCandidate.website || incomingLead.website,
      address: existingCandidate.address || incomingLead.address,
      operatorNotes: updatedNotes,
      lastContactedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, existingCandidate.id));

  // Log audit event
  await logCandidateEvent({
    candidateId: existingCandidate.id,
    eventType: "LEAD_CAPTURED",
    title: `Multi-Touch Dedup (${matchType}): Re-engaged via ${channel}`,
    description: `Incoming prospect matched existing record '${existingCandidate.businessName}' via ${matchType}. Profiles merged automatically.`,
    channel: "SYSTEM",
    actor: "Dedup Engine",
    metadata: {
      matchType,
      incomingBusinessName: incomingLead.businessName,
      channel,
    },
  });

  return existingCandidate.id;
}

/**
 * Standardizes messy scraped category strings into clean, professional B2B labels.
 * Eliminates typos like 'akshar sqaure' and converts generic terms into commercial roles.
 */
export function cleanLeadCategory(rawCategory?: string | null): string {
  if (!rawCategory) return "Commercial Specifier";
  const lower = rawCategory.toLowerCase();

  // Commercial Interior Designers & Architects
  if (lower.includes("architect")) return "Commercial Architect";
  if (lower.includes("interior") || lower.includes("designer")) return "Commercial Interior Designer";
  if (lower.includes("fitout") || lower.includes("contractor") || lower.includes("turnkey")) return "Fitout Contractor";

  // Coworking & Commercial Real Estate
  if (lower.includes("coworking") || lower.includes("co-working")) return "Coworking Space Operator";

  // Furniture & Workstation Manufacturers / Companies
  if (lower.includes("furniture company") || lower.includes("furniture manufacturer")) {
    return "Office Furniture Partner";
  }

  // Corporate & IT Offices
  if (lower.includes("it office") || lower.includes("software") || lower.includes("tech")) {
    return "Corporate IT Enterprise";
  }
  if (lower.includes("corporate") || lower.includes("business park") || lower.includes("office")) {
    return "Corporate Headquarters";
  }

  // Fallback clean label
  return "Commercial Specifier";
}
