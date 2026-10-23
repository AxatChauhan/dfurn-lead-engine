import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { searches, candidates, outreachMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runMultiSourceDiscovery } from "@/lib/discovery";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const industry = String(body.industry || "Architects").trim();
    const location = String(body.location || "Ahmedabad").trim();
    const targetCount = Number(body.targetCount) || 20;

    const searchId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create search record
    db.insert(searches)
      .values({
        id: searchId,
        industry,
        location,
        targetCount,
        status: "running",
        candidatesFound: 0,
        qualifiedCount: 0,
        startedAt: new Date(),
      })
      .run();

    // Run discovery
    const discovered = await runMultiSourceDiscovery(industry, location, targetCount);

    let qualifiedCount = 0;

    for (const item of discovered) {
      const candidateId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // Evaluate lead
      const scoring = evaluateModularLeadScore({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        phone: item.phone,
        website: item.url,
        rating: item.rating,
        reviewCount: item.reviewCount,
      });

      if (scoring.leadTier === "A+" || scoring.leadTier === "A") {
        qualifiedCount++;
      }

      // Insert candidate
      db.insert(candidates)
        .values({
          id: candidateId,
          searchId,
          businessName: item.businessName,
          industry,
          category: item.category,
          city: item.city,
          address: item.address,
          phone: item.phone || null,
          website: item.url || null,
          rating: item.rating || null,
          reviewCount: item.reviewCount || 0,
          sourceType: item.sourceType,
          totalScore: scoring.totalScore,
          leadTier: scoring.leadTier,
          fitScore: scoring.fitScore,
          scaleScore: scoring.scaleScore,
          activityScore: scoring.activityScore,
          accessibilityScore: scoring.accessibilityScore,
          synergyScore: scoring.synergyScore,
          reasoning: scoring.reasoning,
          status: "NEW",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Generate Outreach Copy
      const copy = generateModularOutreach({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        phone: item.phone,
        recommendedHook: scoring.recommendedHook,
      });

      // Insert WhatsApp Outreach Draft
      db.insert(outreachMessages)
        .values({
          id: `msg_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId,
          channel: "WHATSAPP",
          stepNumber: 1,
          subject: "WhatsApp Intro & Swatch Kit Drop-off",
          bodyContent: copy.whatsAppMessage,
          evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
          approvalStatus: "draft_pending_review",
          createdAt: new Date(),
        })
        .run();

      // Insert Email Outreach Draft
      db.insert(outreachMessages)
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
        })
        .run();
    }

    // Update search status
    db.update(searches)
      .set({
        status: "completed",
        candidatesFound: discovered.length,
        qualifiedCount,
        completedAt: new Date(),
      })
      .where(eq(searches.id, searchId))
      .run();

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
