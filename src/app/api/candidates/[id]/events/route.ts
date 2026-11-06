import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidateEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const events = await db
      .select()
      .from(candidateEvents)
      .where(eq(candidateEvents.candidateId, id))
      .orderBy(desc(candidateEvents.createdAt));

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const eventId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEvent = {
      id: eventId,
      candidateId: id,
      eventType: String(body.eventType || "NOTE_UPDATED"),
      title,
      description: body.description ? String(body.description) : null,
      channel: body.channel ? String(body.channel) : "SYSTEM",
      actor: body.actor ? String(body.actor) : "Sales Rep",
      metadata: body.metadata || null,
      createdAt: new Date(),
    };

    await db.insert(candidateEvents).values(newEvent);
    return NextResponse.json({ success: true, event: newEvent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create event" }, { status: 500 });
  }
}
