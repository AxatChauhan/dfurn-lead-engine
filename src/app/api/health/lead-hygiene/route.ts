import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { runAutomatedHygieneSweep, getLastHygieneSweepTime } from "@/lib/hygiene-daemon";
import { validateAndFormatPhone } from "@/lib/qualification-shield";

/**
 * Lead Engine Hygiene & Autonomous Health Telemetry Endpoint
 * Monitors database purity and triggers self-healing on demand.
 * Strictly zero em dashes.
 */

export async function GET() {
  try {
    const all = await db.select().from(candidates);

    let uncallableCount = 0;
    const phoneMap: Record<string, number> = {};
    let rawCategoryCount = 0;

    for (const c of all) {
      // 1. Phone callable check
      const validation = validateAndFormatPhone(c.phone);
      if (!validation.isValid) {
        uncallableCount++;
      } else if (c.phone) {
        const digits = c.phone.replace(/\D/g, "").slice(-10);
        phoneMap[digits] = (phoneMap[digits] || 0) + 1;
      }

      // 2. Category purity check
      const cat = (c.category || "").toLowerCase();
      const ind = (c.industry || "").toLowerCase();
      if (
        cat.includes("sqaure") ||
        cat.includes("furniture company") ||
        cat.includes("office in") ||
        ind.includes("sqaure") ||
        ind.includes("akshar")
      ) {
        rawCategoryCount++;
      }
    }

    const duplicatePhoneGroups = Object.values(phoneMap).filter((count) => count > 1).length;
    const isPure = uncallableCount === 0 && duplicatePhoneGroups === 0 && rawCategoryCount === 0;

    return NextResponse.json({
      status: isPure ? "HEALTHY" : "DRIFT_DETECTED",
      isPure,
      totalCandidates: all.length,
      callableCount: all.length - uncallableCount,
      uncallableCount,
      duplicatePhoneGroups,
      rawCategoryCount,
      lastSweepTime: getLastHygieneSweepTime(),
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const summary = await runAutomatedHygieneSweep();
    return NextResponse.json({
      success: true,
      summary,
      message: `Hygiene sweep completed: ${summary.status}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
