import { NextRequest, NextResponse } from "next/server";
import { pauseSession, resumeSession, cancelSession, getSession } from "@/lib/discovery-session";

/**
 * Discovery Control API Route
 * Handles Pause, Resume, and Cancel actions for active lead discovery sessions.
 * Strictly zero em dashes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, action } = body;

    if (!sessionId || !action) {
      return NextResponse.json({ error: "sessionId and action are required" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or already completed" }, { status: 404 });
    }

    let success = false;
    if (action === "pause") {
      success = pauseSession(sessionId);
    } else if (action === "resume") {
      success = resumeSession(sessionId);
    } else if (action === "cancel") {
      success = cancelSession(sessionId);
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success,
      sessionId,
      action,
      state: {
        isPaused: session.isPaused,
        isCancelled: session.isCancelled,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
