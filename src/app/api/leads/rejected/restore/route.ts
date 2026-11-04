import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const { rejectedId } = await req.json();
    if (!rejectedId) {
      return NextResponse.json({ error: "rejectedId is required" }, { status: 400 });
    }

    const [rejected] = await db
      .select()
      .from(rejectedLeads)
      .where(eq(rejectedLeads.id, rejectedId))
      .limit(1);

    if (!rejected) {
      return NextResponse.json({ error: "Rejected lead not found" }, { status: 404 });
    }

    const candidateId = `cand_${nanoid(12)}`;

    // Re-insert into candidates
    await db.insert(candidates).values({
      id: candidateId,
      businessName: rejected.businessName,
      contactPerson: rejected.contactPerson || undefined,
      phone: rejected.phone || "None",
      email: rejected.email || undefined,
      city: rejected.city || "Ahmedabad",
      leadSource: rejected.leadSource || "paid_ads_meta",
      category: rejected.category || "Commercial Specifier",
      qualificationStage: "NEW",
      leadTier: "A",
      operatorNotes: `Restored by operator. Original rejection reason: ${rejected.rejectionReason}. Notes: ${rejected.notes || "None"}`,
      status: "NEW",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log event in candidateEvents
    await db.insert(candidateEvents).values({
      id: `evt_${nanoid(12)}`,
      candidateId,
      eventType: "LEAD_RESTORED",
      title: "Lead Restored to Pipeline",
      description: `Lead restored by operator from Rejected Leads (prior rejection: ${rejected.rejectionReason})`,
      channel: "SYSTEM",
      actor: "OPERATOR",
      createdAt: new Date(),
    });

    // Remove from rejectedLeads
    await db.delete(rejectedLeads).where(eq(rejectedLeads.id, rejectedId));

    return NextResponse.json({
      success: true,
      candidateId,
      message: `Restored ${rejected.businessName} to active lead pipeline`,
    });
  } catch (err: any) {
    console.error("Error restoring rejected lead:", err);
    return NextResponse.json({ error: err.message || "Failed to restore lead" }, { status: 500 });
  }
}
