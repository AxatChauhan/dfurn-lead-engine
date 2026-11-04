import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, outreachMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const queue = await db
      .select({
        id: outreachMessages.id,
        candidateId: candidates.id,
        candidateName: candidates.businessName,
        contactPerson: candidates.contactPerson,
        category: candidates.category,
        city: candidates.city,
        phone: candidates.phone,
        email: candidates.email,
        leadTier: candidates.leadTier,
        totalScore: candidates.totalScore,
        channel: outreachMessages.channel,
        subject: outreachMessages.subject,
        bodyContent: outreachMessages.bodyContent,
        approvalStatus: outreachMessages.approvalStatus,
        whatsappAvailable: candidates.whatsappAvailable,
        createdAt: candidates.createdAt,
      })
      .from(outreachMessages)
      .innerJoin(candidates, eq(outreachMessages.candidateId, candidates.id))
      .where(eq(outreachMessages.approvalStatus, "draft_pending_review"))
      .orderBy(desc(candidates.totalScore));

    return NextResponse.json({ queue });
  } catch (error: any) {
    console.error("[Queue API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch review queue" }, { status: 500 });
  }
}
