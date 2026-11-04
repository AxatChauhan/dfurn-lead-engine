import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, outreachMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
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
 * Single Lead Contact & Phone Enricher
 * Dedicated endpoint to search Google Maps, candidate website, and web directories
 * to recover missing telephone numbers for lost/incomplete leads.
 * Strictly zero em dashes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const city = candidate.city || "Ahmedabad";
    let foundPhone = "";
    let foundAddress = candidate.address || "";
    let foundWebsite = candidate.website || "";

    // 1. Google Maps Knowledge Panel Enrichment
    try {
      const mapsData = await enrichLeadPhoneFromGoogleMaps(candidate.businessName, city);
      if (mapsData.phone) {
        foundPhone = sanitizeIndianPhone(mapsData.phone);
      }
      if (mapsData.address && !foundAddress) {
        foundAddress = mapsData.address;
      }
      if (mapsData.website && !foundWebsite) {
        foundWebsite = mapsData.website;
      }
    } catch (e: any) {
      console.warn(`[Enrich API] Google Maps enrichment failed for ${candidate.businessName}:`, e?.message);
    }

    // 2. Direct Website & WhatsApp Probing (if website known and phone still missing)
    if (!foundPhone && foundWebsite && foundWebsite.startsWith("http")) {
      try {
        const audit = await auditCandidateWebsite(foundWebsite);
        if (audit.phone) {
          foundPhone = sanitizeIndianPhone(audit.phone);
        }
      } catch (e: any) {
        console.warn(`[Enrich API] Website probe failed for ${candidate.businessName}:`, e?.message);
      }
    }

    // 3. Fallback Web Directory Search (DuckDuckGo contact query)
    if (!foundPhone) {
      try {
        const query = `${candidate.businessName} ${city} contact phone`;
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
            if (pMatch) {
              foundPhone = sanitizeIndianPhone(pMatch[0]);
            }
            if (!foundWebsite) {
              const href = $(el).find(".result__title a").attr("href") || "";
              if (href.includes("uddg=")) {
                try {
                  const parsed = new URL(href, "https://duckduckgo.com");
                  const uddg = parsed.searchParams.get("uddg");
                  if (uddg && !uddg.includes("duckduckgo.com") && !uddg.includes("wikipedia.org")) {
                    foundWebsite = decodeURIComponent(uddg);
                  }
                } catch (_) {}
              }
            }
          });
        }
      } catch (e: any) {
        console.warn(`[Enrich API] Directory search failed for ${candidate.businessName}:`, e?.message);
      }
    }

    // If phone found, recover lead from LOST to NEW
    if (foundPhone && foundPhone !== "-" && foundPhone !== "–") {
      // Re-evaluate 5D modular lead score
      const scoring = evaluateModularLeadScore({
        businessName: candidate.businessName,
        category: candidate.category || "Architect",
        city,
        phone: foundPhone,
        email: candidate.email || undefined,
        website: foundWebsite || undefined,
        rating: candidate.rating ? Number(candidate.rating) : undefined,
        reviewCount: candidate.reviewCount || undefined,
        hasCommercialFocus: candidate.hasCommercialFocus !== false,
      });

      // Regenerate WhatsApp outreach message with verified phone
      const copy = generateModularOutreach({
        businessName: candidate.businessName,
        category: candidate.category || "Architect",
        city,
        phone: foundPhone,
        recommendedHook: scoring.recommendedHook,
      });

      await db.update(candidates)
        .set({
          phone: foundPhone,
          address: foundAddress || undefined,
          website: foundWebsite || undefined,
          qualificationStage: "NEW", // Recover from LOST
          enrichmentStatus: "ENRICHED",
          totalScore: scoring.totalScore,
          leadTier: scoring.leadTier,
          operatorNotes: "Phone verified via contact enricher (recovered from Lost Leads)",
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id));

      // Update existing WhatsApp message or insert new one
      const existingMsgs = await db
        .select()
        .from(outreachMessages)
        .where(eq(outreachMessages.candidateId, id));

      if (existingMsgs.length > 0) {
        await db.update(outreachMessages)
          .set({
            bodyContent: copy.whatsAppMessage,
            evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
          })
          .where(eq(outreachMessages.candidateId, id));
      } else {
        await db.insert(outreachMessages).values({
          id: `msg_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId: id,
          channel: "WHATSAPP",
          stepNumber: 1,
          subject: "WhatsApp Intro & CAD Library Access",
          bodyContent: copy.whatsAppMessage,
          evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
          approvalStatus: "draft_pending_review",
          createdAt: new Date(),
        });
      }

      await logCandidateEvent({
        candidateId: id,
        eventType: "STAGE_CHANGED",
        title: "Phone Enriched & Recovered",
        description: `Discovered verified number ${foundPhone}. Restored from Lost to New.`,
        channel: "SYSTEM",
        metadata: { phone: foundPhone, previousStage: candidate.qualificationStage },
      });

      const [updated] = await db.select().from(candidates).where(eq(candidates.id, id));

      return NextResponse.json({
        success: true,
        recovered: true,
        phone: foundPhone,
        candidate: updated,
        message: `Phone number verified: ${foundPhone}. Lead restored to New!`,
      });
    }

    // Phone not found
    return NextResponse.json({
      success: false,
      recovered: false,
      candidate,
      message: `No public telephone or WhatsApp number found across Google Maps and web directories for ${candidate.businessName}.`,
    });
  } catch (error: any) {
    console.error("[Enrich API] Unhandled error:", error);
    return NextResponse.json({ error: error.message || "Enrichment failed" }, { status: 500 });
  }
}
