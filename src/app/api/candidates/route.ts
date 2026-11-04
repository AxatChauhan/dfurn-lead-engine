import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const tier = searchParams.get("tier");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const dummy = searchParams.get("dummy");

    const conditions: any[] = [];
    if (stage && stage !== "ALL") {
      conditions.push(eq(candidates.qualificationStage, stage));
    }
    if (tier && tier !== "ALL") {
      conditions.push(eq(candidates.leadTier, tier));
    }
    if (category && category !== "ALL") {
      conditions.push(eq(candidates.category, category));
    }
    if (city && city !== "ALL") {
      conditions.push(eq(candidates.city, city));
    }
    if (source && source !== "ALL") {
      conditions.push(eq(candidates.leadSource, source));
    }
    if (status && status !== "ALL") {
      conditions.push(eq(candidates.status, status));
    }
    if (dummy === "true") {
      conditions.push(eq(candidates.isDummyPhone, true));
    } else if (dummy === "false") {
      conditions.push(eq(candidates.isDummyPhone, false));
    }

    const query = db.select().from(candidates);
    const candidateList = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(candidates.createdAt))
      : await query.orderBy(desc(candidates.createdAt));

    // Aggregated counts for stage tabs & tier tabs
    const allCandidates = await db
      .select({
        leadTier: candidates.leadTier,
        status: candidates.status,
        qualificationStage: candidates.qualificationStage,
        leadSource: candidates.leadSource,
        isDummyPhone: candidates.isDummyPhone,
      })
      .from(candidates);

    const stageCounts = {
      total: allCandidates.length,
      new: allCandidates.filter((c) => (c.qualificationStage || "NEW") === "NEW" && !c.isDummyPhone).length,
      contacted: allCandidates.filter((c) => c.qualificationStage === "CONTACTED").length,
      followUp: allCandidates.filter((c) => c.qualificationStage === "FOLLOW_UP").length,
      qualified: allCandidates.filter((c) => c.qualificationStage === "QUALIFIED").length,
      converted: allCandidates.filter((c) => c.qualificationStage === "CONVERTED" || c.status === "SYNCED_TO_ERP").length,
      lost: allCandidates.filter((c) => c.qualificationStage === "LOST" || c.status === "REJECTED").length,
      dummy: allCandidates.filter((c) => c.isDummyPhone).length,
    };

    const counts = {
      ...stageCounts,
      tierAPlus: allCandidates.filter((c) => c.leadTier === "A+").length,
      tierA: allCandidates.filter((c) => c.leadTier === "A").length,
      tierB: allCandidates.filter((c) => c.leadTier === "B").length,
      tierC: allCandidates.filter((c) => c.leadTier === "C" || c.leadTier === "D").length,
      syncedToErp: allCandidates.filter((c) => c.status === "SYNCED_TO_ERP").length,
    };

    const channelCounts: Record<string, number> = {
      ALL: allCandidates.length,
      paid_ads_meta: allCandidates.filter((c) => c.leadSource === "paid_ads_meta").length,
      paid_ads_google: allCandidates.filter((c) => c.leadSource === "paid_ads_google").length,
      website_form: allCandidates.filter((c) => c.leadSource === "website_form" || c.leadSource === "website").length,
      google_maps: allCandidates.filter((c) => c.leadSource === "google_maps").length,
      linkedin_signal: allCandidates.filter((c) => c.leadSource === "linkedin_signal").length,
      trade_referral: allCandidates.filter((c) => c.leadSource === "trade_referral").length,
    };

    return NextResponse.json({
      candidates: candidateList,
      counts,
      stageCounts,
      channelCounts,
    });
  } catch (error: any) {
    console.error("[Candidates API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch candidates" }, { status: 500 });
  }
}
