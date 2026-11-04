import { db } from "@/db";
import { candidateEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type EventType =
  | "LEAD_CAPTURED"
  | "STAGE_CHANGED"
  | "OUTREACH_SENT"
  | "SWATCH_UPDATED"
  | "NOTE_UPDATED"
  | "ERP_SYNCED"
  | "CALL_LOGGED";

export async function logCandidateEvent(params: {
  candidateId: string;
  eventType: EventType;
  title: string;
  description?: string;
  channel?: "WHATSAPP" | "EMAIL" | "PHONE" | "SYSTEM" | "ERP";
  metadata?: any;
  actor?: string;
}) {
  try {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.insert(candidateEvents).values({
      id,
      candidateId: params.candidateId,
      eventType: params.eventType,
      title: params.title,
      description: params.description || null,
      channel: params.channel || "SYSTEM",
      metadata: params.metadata || null,
      actor: params.actor || "Sales Operator",
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[Candidate Event Logger] Error:", err);
  }
}

export async function getCandidateEvents(candidateId: string) {
  try {
    return await db
      .select()
      .from(candidateEvents)
      .where(eq(candidateEvents.candidateId, candidateId))
      .orderBy(desc(candidateEvents.createdAt));
  } catch (err) {
    console.error("[Candidate Events Fetch] Error:", err);
    return [];
  }
}
