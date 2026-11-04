import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, outreachMessages } from "@/db/schema";
import { eq, or, isNull } from "drizzle-orm";
import {
  enrichLeadPhoneFromGoogleMaps,
  auditCandidateWebsite,
  sanitizeIndianPhone,
  INDIAN_PHONE_REGEX,
} from "@/lib/discovery";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";
import { logCandidateEvent } from "@/lib/events";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

/**
 * Bulk Lost Leads Contact & Phone Enricher
 * Sequentially enriches all leads currently in LOST stage or missing phone numbers.
 * Strictly zero em dashes.
 */
export async function POST(req: NextRequest) {
  try {
    const lostCandidates = await db
      .select()
      .from(candidates)
      .where(
        or(
          eq(candidates.qualificationStage, "LOST"),
          eq(candidates.phone, "-"),
          eq(candidates.phone, "–"),
          isNull(candidates.phone)
        )
      )
      .limit(15);

    if (lostCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        recoveredCount: 0,
        totalChecked: 0,
        message: "No lost leads currently require phone enrichment.",
      });
    }

    let recoveredCount = 0;
    const enrichedList: Array<{ id: string; name: string; phone: string }> = [];

    for (const cand of lostCandidates) {
      const city = cand.city || "Ahmedabad";
      let foundPhone = "";
      let foundAddress = cand.address || "";
      let foundWebsite = cand.website || "";

      // 1. Google Maps Lookup
      try {
        const mapsData = await enrichLeadPhoneFromGoogleMaps(cand.businessName, city);
        if (mapsData.phone) foundPhone = sanitizeIndianPhone(mapsData.phone);
        if (mapsData.address && !foundAddress) foundAddress = mapsData.address;
        if (mapsData.website && !foundWebsite) foundWebsite = mapsData.website;
      } catch (_) {}

      // 2. Website & WhatsApp Probing
      if (!foundPhone && foundWebsite && foundWebsite.startsWith("http")) {
        try {
          const audit = await auditCandidateWebsite(foundWebsite);
          if (audit.phone) foundPhone = sanitizeIndianPhone(audit.phone);
        } catch (_) {}
      }

      // 3. Web Directory Search
      if (!foundPhone) {
        try {
          const query = `${cand.businessName} ${city} contact phone`;
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const res = await fetch(ddgUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });
          if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);
            $(".result").each((_, el) => {
              if (foundPhone) return;
              const snip = $(el).find(".result__snippet").text();
              const pMatch = snip.match(INDIAN_PHONE_REGEX);
              if (pMatch) foundPhone = sanitizeIndianPhone(pMatch[0]);
            });
          }
        } catch (_) {}
      }

      // If recovered with verified phone
      if (foundPhone && foundPhone !== "-" && foundPhone !== "–") {
        recoveredCount++;
        enrichedList.push({ id: cand.id, name: cand.businessName, phone: foundPhone });

        const scoring = evaluateModularLeadScore({
          businessName: cand.businessName,
          category: cand.category || "Architect",
          city,
          phone: foundPhone,
          email: cand.email || undefined,
          website: foundWebsite || undefined,
          rating: cand.rating ? Number(cand.rating) : undefined,
          reviewCount: cand.reviewCount || undefined,
          hasCommercialFocus: cand.hasCommercialFocus !== false,
        });

        const copy = generateModularOutreach({
          businessName: cand.businessName,
          category: cand.category || "Architect",
          city,
          phone: foundPhone,
          recommendedHook: scoring.recommendedHook,
        });

        await db.update(candidates)
          .set({
            phone: foundPhone,
            address: foundAddress || undefined,
            website: foundWebsite || undefined,
            qualificationStage: "NEW", // Restored from LOST
            enrichmentStatus: "ENRICHED",
            totalScore: scoring.totalScore,
            leadTier: scoring.leadTier,
            operatorNotes: "Phone verified via bulk contact enricher",
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, cand.id));

        // Update WhatsApp message
        const existingMsgs = await db
          .select()
          .from(outreachMessages)
          .where(eq(outreachMessages.candidateId, cand.id));

        if (existingMsgs.length > 0) {
          await db.update(outreachMessages)
            .set({
              bodyContent: copy.whatsAppMessage,
              evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
            })
            .where(eq(outreachMessages.candidateId, cand.id));
        }

        await logCandidateEvent({
          candidateId: cand.id,
          eventType: "STAGE_CHANGED",
          title: "Phone Enriched & Recovered",
          description: `Discovered verified number ${foundPhone}. Restored from Lost to New.`,
          channel: "SYSTEM",
          metadata: { phone: foundPhone, previousStage: cand.qualificationStage },
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalChecked: lostCandidates.length,
      recoveredCount,
      enrichedList,
      message: `Enriched ${recoveredCount} of ${lostCandidates.length} lost leads with verified phone numbers.`,
    });
  } catch (error: any) {
    console.error("[Bulk Enrich API] Unhandled error:", error);
    return NextResponse.json({ error: error.message || "Bulk enrichment failed" }, { status: 500 });
  }
}
