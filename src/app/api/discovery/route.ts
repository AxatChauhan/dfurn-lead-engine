import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { searches, outreachMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runMultiSourceDiscovery } from "@/lib/discovery";
import { generateModularOutreach } from "@/lib/copywriting";
import { ingestCandidateLead } from "@/lib/intake-pipeline";

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
    let duplicateMergedCount = 0;
    let residentialRejectedCount = 0;

    for (const item of discovered) {
      const ingestRes = await ingestCandidateLead(
        {
          searchId,
          businessName: item.businessName,
          category: item.category || industry,
          industry,
          city: item.city || location,
          address: item.address,
          phone: item.phone,
          email: item.email,
          website: item.url,
          rating: item.rating,
          reviewCount: item.reviewCount,
          sourceType: item.sourceType || "google_maps",
          leadSource: "google_maps",
          notes: `Discovered in sweep (${industry} · ${location})`,
        },
        {
          channel: "discovery_sweep",
          actor: "Discovery Crawler",
        }
      );

      if (!ingestRes.success) {
        residentialRejectedCount++;
        continue;
      }

      if (ingestRes.action === "MERGED") {
        duplicateMergedCount++;
        continue;
      }

      if (ingestRes.action === "CREATED") {
        if (ingestRes.leadTier === "A+" || ingestRes.leadTier === "A") {
          qualifiedCount++;
        }

        // Generate Online Outreach Copy
        const copy = generateModularOutreach({
          businessName: ingestRes.businessName,
          category: ingestRes.category,
          city: ingestRes.city,
          phone: ingestRes.phone,
          recommendedHook: "Factory-direct modular workstations with 15-day turnaround",
        });

        // Insert WhatsApp Outreach Draft
        await db.insert(outreachMessages).values({
          id: `msg_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId: ingestRes.candidateId,
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
          await db.insert(outreachMessages).values({
            id: `msg_em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            candidateId: ingestRes.candidateId,
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
      duplicateMergedCount,
      residentialRejectedCount,
    });
  } catch (error: any) {
    console.error("[Discovery Route] Error:", error);
    return NextResponse.json({ error: error.message || "Discovery process failed" }, { status: 500 });
  }
}
