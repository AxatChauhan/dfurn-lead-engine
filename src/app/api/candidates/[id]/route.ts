import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, outreachMessages, erpSyncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { crawlFirmWebsite } from "@/lib/crawler";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";
import { logCandidateEvent } from "@/lib/events";
import { sanitizeIndianPhone } from "@/lib/discovery";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.candidateId, id));

    const syncLogs = await db
      .select()
      .from(erpSyncLogs)
      .where(eq(erpSyncLogs.candidateId, id));

    return NextResponse.json({
      candidate,
      messages,
      syncLogs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;

    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Action: Crawl website & re-evaluate
    if (action === "crawl") {
      if (!candidate.website) {
        return NextResponse.json({ error: "Candidate does not have a website URL" }, { status: 400 });
      }

      const crawlData = await crawlFirmWebsite(candidate.website);

      // Re-evaluate 5D score
      const scoring = evaluateModularLeadScore({
        businessName: candidate.businessName,
        category: candidate.category || "Commercial Office",
        city: candidate.city || "Ahmedabad",
        phone: crawlData.phone || candidate.phone,
        email: crawlData.email || candidate.email || undefined,
        website: candidate.website,
        rating: candidate.rating ? Number(candidate.rating) : undefined,
        reviewCount: candidate.reviewCount || undefined,
        hasCommercialFocus: crawlData.hasCommercialFocus,
        whatsappAvailable: crawlData.whatsappAvailable,
        portfolioTags: crawlData.portfolioTags,
        decisionMakersCount: crawlData.decisionMakers.length,
      });

      // Update candidate
      await db.update(candidates)
        .set({
          phone: crawlData.phone || candidate.phone,
          email: crawlData.email || candidate.email,
          decisionMakers: JSON.stringify(crawlData.decisionMakers),
          portfolioTags: JSON.stringify(crawlData.portfolioTags),
          hasCommercialFocus: crawlData.hasCommercialFocus,
          whatsappAvailable: crawlData.whatsappAvailable,
          totalScore: scoring.totalScore,
          leadTier: scoring.leadTier,
          fitScore: scoring.fitScore,
          scaleScore: scoring.scaleScore,
          activityScore: scoring.activityScore,
          accessibilityScore: scoring.accessibilityScore,
          synergyScore: scoring.synergyScore,
          reasoning: scoring.reasoning,
          rawAudit: JSON.stringify(crawlData),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id));

      // Regenerate messages
      const keyContact = crawlData.decisionMakers[0]?.name || null;
      const copy = generateModularOutreach({
        businessName: candidate.businessName,
        category: candidate.category || "Commercial Office",
        city: candidate.city || "Ahmedabad",
        contactName: keyContact,
        phone: crawlData.phone || candidate.phone,
        portfolioTags: crawlData.portfolioTags,
        recommendedHook: scoring.recommendedHook,
      });

      // Update existing messages
      await db.update(outreachMessages)
        .set({
          bodyContent: copy.whatsAppMessage,
          evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
        })
        .where(eq(outreachMessages.candidateId, id));

      const [updated] = await db.select().from(candidates).where(eq(candidates.id, id));
      return NextResponse.json({ success: true, candidate: updated });
    }

    // Action: Update status
    if (action === "update_status") {
      const newStatus = body.status;
      await db.update(candidates)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(candidates.id, id));

      return NextResponse.json({ success: true });
    }

    // Action: Update Message approval
    if (action === "update_message") {
      const { messageId, approvalStatus, bodyContent } = body;
      const updateData: any = {};
      if (approvalStatus) updateData.approvalStatus = approvalStatus;
      if (bodyContent) updateData.bodyContent = bodyContent;
      if (approvalStatus === "approved") updateData.approvedAt = new Date();
      if (approvalStatus === "sent") updateData.sentAt = new Date();

      await db.update(outreachMessages)
        .set(updateData)
        .where(eq(outreachMessages.id, messageId));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (body.qualificationStage !== undefined) {
      updateFields.qualificationStage = body.qualificationStage;
      // Record first contacted timestamp on outreach or progression from NEW
      if (
        (body.qualificationStage === "CONTACTED" || body.qualificationStage === "FOLLOW_UP" || body.qualificationStage === "QUALIFIED") &&
        !candidate.firstContactedAt
      ) {
        updateFields.firstContactedAt = new Date();
      }
      if (body.qualificationStage === "CONTACTED" && !candidate.lastContactedAt) {
        updateFields.lastContactedAt = new Date();
      }
    }

    if (body.operatorNotes !== undefined) updateFields.operatorNotes = body.operatorNotes;
    if (body.contactPerson !== undefined) updateFields.contactPerson = body.contactPerson;
    if (body.phone !== undefined) {
      updateFields.phone = sanitizeIndianPhone(body.phone) || body.phone;
      updateFields.isDummyPhone = false;
    }
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.city !== undefined) updateFields.city = body.city;
    if (body.projectType !== undefined) updateFields.projectType = body.projectType;
    if (body.workstationCount !== undefined) {
      updateFields.workstationCount = body.workstationCount ? parseInt(body.workstationCount, 10) : null;
    }
    if (body.hasFloorPlan !== undefined) updateFields.hasFloorPlan = Boolean(body.hasFloorPlan);
    if (body.projectTimeline !== undefined) updateFields.projectTimeline = body.projectTimeline;
    if (body.estimatedBudget !== undefined) updateFields.estimatedBudget = body.estimatedBudget;
    
    // Material samples lifecycle updates
    if (body.swatchBoxStatus !== undefined) updateFields.swatchBoxStatus = body.swatchBoxStatus;
    if (body.swatchBoxCourier !== undefined) updateFields.swatchBoxCourier = body.swatchBoxCourier;
    if (body.swatchBoxAwb !== undefined) updateFields.swatchBoxAwb = body.swatchBoxAwb;

    if (body.markContacted) {
      if (!candidate.firstContactedAt) updateFields.firstContactedAt = new Date();
      updateFields.lastContactedAt = new Date();
      if (!body.qualificationStage && candidate.qualificationStage === "NEW") {
        updateFields.qualificationStage = "CONTACTED";
      }
    }

    await db.update(candidates)
      .set(updateFields)
      .where(eq(candidates.id, id));

    // Audit Event Logging
    if (body.phone !== undefined && body.phone !== candidate.phone) {
      await logCandidateEvent({
        candidateId: id,
        eventType: "NOTE_UPDATED",
        title: "Phone Number Enriched",
        description: `Phone updated to ${updateFields.phone}`,
        channel: "SYSTEM",
        actor: "Sales Rep",
      });
    }

    if (body.qualificationStage && body.qualificationStage !== candidate.qualificationStage) {
      await logCandidateEvent({
        candidateId: id,
        eventType: "STAGE_CHANGED",
        title: `Stage: ${body.qualificationStage}`,
        description: `Moved from ${candidate.qualificationStage} to ${body.qualificationStage}`,
        channel: "SYSTEM",
      });
    }

    if (body.logWhatsAppOutreach) {
      await logCandidateEvent({
        candidateId: id,
        eventType: "OUTREACH_SENT",
        title: "WhatsApp Outreach Dispatched",
        description: "Speed-to-lead response sent via WhatsApp Web",
        channel: "WHATSAPP",
      });
    }

    const [updated] = await db.select().from(candidates).where(eq(candidates.id, id));

    return NextResponse.json({ success: true, candidate: updated });
  } catch (error: any) {
    console.error("[Candidate PATCH API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update candidate" }, { status: 500 });
  }
}
