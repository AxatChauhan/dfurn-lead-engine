import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, outreachMessages, erpSyncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { crawlFirmWebsite } from "@/lib/crawler";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = db.select().from(candidates).where(eq(candidates.id, id)).get();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const messages = db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.candidateId, id))
      .all();

    const syncLogs = db
      .select()
      .from(erpSyncLogs)
      .where(eq(erpSyncLogs.candidateId, id))
      .all();

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

    const candidate = db.select().from(candidates).where(eq(candidates.id, id)).get();
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
        category: candidate.category,
        city: candidate.city,
        phone: crawlData.phone || candidate.phone,
        email: crawlData.email || candidate.email,
        website: candidate.website,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
        hasCommercialFocus: crawlData.hasCommercialFocus,
        whatsappAvailable: crawlData.whatsappAvailable,
        portfolioTags: crawlData.portfolioTags,
        decisionMakersCount: crawlData.decisionMakers.length,
      });

      // Update candidate
      db.update(candidates)
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
        .where(eq(candidates.id, id))
        .run();

      // Regenerate messages
      const keyContact = crawlData.decisionMakers[0]?.name || null;
      const copy = generateModularOutreach({
        businessName: candidate.businessName,
        category: candidate.category,
        city: candidate.city,
        contactName: keyContact,
        phone: crawlData.phone || candidate.phone,
        portfolioTags: crawlData.portfolioTags,
        recommendedHook: scoring.recommendedHook,
      });

      // Update existing messages
      db.update(outreachMessages)
        .set({
          bodyContent: copy.whatsAppMessage,
          evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
        })
        .where(eq(outreachMessages.candidateId, id))
        .run();

      const updated = db.select().from(candidates).where(eq(candidates.id, id)).get();
      return NextResponse.json({ success: true, candidate: updated });
    }

    // Action: Update status
    if (action === "update_status") {
      const newStatus = body.status;
      db.update(candidates)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(candidates.id, id))
        .run();

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

      db.update(outreachMessages)
        .set(updateData)
        .where(eq(outreachMessages.id, messageId))
        .run();

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
