import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const { candidateId, rejectionReason, notes } = await req.json();

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidateId))
      .limit(1);

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const rejectId = `rej_${Date.now()}_${nanoid(6)}`;

    // 1. Move to rejectedLeads table
    await db.insert(rejectedLeads).values({
      id: rejectId,
      businessName: candidate.businessName,
      contactPerson: candidate.contactPerson || undefined,
      phone: candidate.phone || undefined,
      email: candidate.email || undefined,
      city: candidate.city,
      leadSource: candidate.leadSource || "direct",
      category: candidate.category || "General",
      rejectionReason: rejectionReason || "OPERATOR_DISQUALIFIED",
      notes: notes || candidate.operatorNotes || "Manually disqualified by operator",
      rawPayload: candidate,
      rejectedAt: new Date(),
    });

    // 2. Remove from active candidates
    await db.delete(candidates).where(eq(candidates.id, candidateId));

    return NextResponse.json({
      success: true,
      rejectId,
      message: `Lead ${candidate.businessName} has been moved to Rejected Leads`,
    });
  } catch (err: any) {
    console.error("Error rejecting candidate:", err);
    return NextResponse.json({ error: err.message || "Failed to reject candidate" }, { status: 500 });
  }
}
