import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { searches, candidates, outreachMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runMultiSourceDiscovery } from "@/lib/discovery";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";

/**
 * Discovery API Route
 * Executes automated Google Maps & web scraping, cognitive website audits, and 5D scoring.
 * Strictly zero em dashes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const industry = String(body.industry || "Architects").trim();
    const location = String(body.location || "Ahmedabad").trim();
    const targetCount = Number(body.targetCount) || 15;
    const runAudit = body.runAudit !== false;

    const searchId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create search record
    await db.insert(searches)
      .values({
        id: searchId,
        industry,
        location,
        targetCount,
        status: "running",
        candidatesFound: 0,
        qualifiedCount: 0,
        startedAt: new Date(),
      });

    // Determine single corridor vs multi-corridor geographic sweep
    const isMultiCorridor = location === "ALL_AHMEDABAD" || location === "ALL_GUJARAT" || body.multiCorridor === true || targetCount >= 40;
    const corridors = isMultiCorridor
      ? [
          "Bodakdev & Sindhu Bhavan Road Ahmedabad",
          "Prahlad Nagar & SG Highway Ahmedabad",
          "GIFT City & Gandhinagar SEZ",
          "CG Road & Navrangpura Ahmedabad",
          "Science City & Sola Ahmedabad",
          "Vesu & Diamond Bourse Surat",
          "Alkapuri & Gotri Vadodara",
        ]
      : [location];

    console.log(`[Discovery Route] Executing discovery across ${corridors.length} corridor(s) for target: ${targetCount} leads.`);

    let allDiscovered: any[] = [];
    const perCorridorLimit = Math.max(Math.ceil(targetCount / corridors.length), 12);

    for (const corr of corridors) {
      const batch = await runMultiSourceDiscovery(industry, corr, perCorridorLimit, runAudit);
      allDiscovered = allDiscovered.concat(batch);
      if (allDiscovered.length >= targetCount) break;
    }

    // Deduplicate across corridors
    const seen = new Set<string>();
    const discovered = allDiscovered.filter((it) => {
      const key = it.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, targetCount);

    let qualifiedCount = 0;

    for (const item of discovered) {
      const candidateId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // Evaluate lead with enriched audit signals
      const scoring = evaluateModularLeadScore({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        phone: item.phone,
        email: item.email,
        website: item.url,
        rating: item.rating,
        reviewCount: item.reviewCount,
        hasCommercialFocus: item.hasCommercialFocus,
        portfolioTags: item.commercialTags,
      });

      if (scoring.leadTier === "A+" || scoring.leadTier === "A") {
        qualifiedCount++;
      }

      const decisionMakers = item.linkedInUrl
        ? JSON.stringify([{ name: item.businessName, linkedin: item.linkedInUrl }])
        : null;

      // Insert candidate record into PostgreSQL
      await db.insert(candidates)
        .values({
          id: candidateId,
          searchId,
          businessName: item.businessName,
          industry,
          category: item.category,
          city: item.city,
          address: item.address,
          phone: item.phone || "-",
          email: item.email || null,
          website: item.url || null,
          rating: item.rating ? String(item.rating) : null,
          reviewCount: item.reviewCount || 0,
          sourceType: item.sourceType,
          leadSource: "google_maps",
          totalScore: scoring.totalScore,
          leadTier: scoring.leadTier,
          fitScore: scoring.fitScore,
          scaleScore: scoring.scaleScore,
          activityScore: scoring.activityScore,
          accessibilityScore: scoring.accessibilityScore,
          synergyScore: scoring.synergyScore,
          reasoning: scoring.reasoning,
          portfolioTags: item.commercialTags ? JSON.stringify(item.commercialTags) : null,
          hasCommercialFocus: item.hasCommercialFocus !== false,
          decisionMakers,
          status: "NEW",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      // Generate Online Outreach Copy
      const copy = generateModularOutreach({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        phone: item.phone,
        recommendedHook: scoring.recommendedHook,
        portfolioTags: item.commercialTags,
      });

      // Insert WhatsApp Outreach Draft
      await db.insert(outreachMessages)
        .values({
          id: `msg_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId,
          channel: "WHATSAPP",
          stepNumber: 1,
          subject: "WhatsApp Intro & CAD Library Access",
          bodyContent: copy.whatsAppMessage,
          evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
          approvalStatus: "draft_pending_review",
          createdAt: new Date(),
        });

      // Insert Email Outreach Draft
      if (copy.coldEmail && copy.coldEmail.body) {
        await db.insert(outreachMessages)
          .values({
            id: `msg_em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            candidateId,
            channel: "EMAIL",
            stepNumber: 1,
            subject: copy.coldEmail.subject,
            bodyContent: copy.coldEmail.body,
            evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
            approvalStatus: "draft_pending_review",
            createdAt: new Date(),
          });
      }
    }

    // Update search record status
    await db.update(searches)
      .set({
        status: "completed",
        candidatesFound: discovered.length,
        qualifiedCount,
        completedAt: new Date(),
      })
      .where(eq(searches.id, searchId));

    return NextResponse.json({
      success: true,
      searchId,
      candidatesFound: discovered.length,
      qualifiedCount,
    });
  } catch (error: any) {
    console.error("[Discovery Route] Error:", error);
    return NextResponse.json({ error: error.message || "Discovery process failed" }, { status: 500 });
  }
}
