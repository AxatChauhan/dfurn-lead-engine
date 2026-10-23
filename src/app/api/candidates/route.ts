import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const status = searchParams.get("status");

    const conditions: any[] = [];
    if (tier && tier !== "ALL") {
      conditions.push(eq(candidates.leadTier, tier));
    }
    if (category && category !== "ALL") {
      conditions.push(eq(candidates.category, category));
    }
    if (city && city !== "ALL") {
      conditions.push(eq(candidates.city, city));
    }
    if (status && status !== "ALL") {
      conditions.push(eq(candidates.status, status));
    }

    const query = db.select().from(candidates);
    const candidateList = conditions.length > 0
      ? query.where(and(...conditions)).orderBy(desc(candidates.totalScore), desc(candidates.createdAt)).all()
      : query.orderBy(desc(candidates.totalScore), desc(candidates.createdAt)).all();

    // Aggregated counts for tabs
    const allCandidates = db.select({ leadTier: candidates.leadTier, status: candidates.status }).from(candidates).all();

    const counts = {
      total: allCandidates.length,
      tierAPlus: allCandidates.filter((c) => c.leadTier === "A+").length,
      tierA: allCandidates.filter((c) => c.leadTier === "A").length,
      tierB: allCandidates.filter((c) => c.leadTier === "B").length,
      tierC: allCandidates.filter((c) => c.leadTier === "C" || c.leadTier === "D").length,
      syncedToErp: allCandidates.filter((c) => c.status === "SYNCED_TO_ERP").length,
    };

    return NextResponse.json({
      candidates: candidateList,
      counts,
    });
  } catch (error: any) {
    console.error("[Candidates API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch candidates" }, { status: 500 });
  }
}
