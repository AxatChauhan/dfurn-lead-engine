import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { searches, candidates, outreachMessages, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchGoogleMaps, searchBing, auditCandidateWebsite, enrichLeadPhoneFromGoogleMaps } from "@/lib/discovery";
import { evaluateModularLeadScore } from "@/lib/evaluator";
import { generateModularOutreach } from "@/lib/copywriting";
import { createSession, removeSession, waitIfPaused } from "@/lib/discovery-session";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) Discovery Stream Route
 * Streams real-time progress, audits websites, and immediately persists leads on the fly.
 * Strictly zero em dashes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const industry = String(body.industry || "Architects").trim();
    const location = String(body.location || "Ahmedabad").trim();
    const targetCount = Number(body.targetCount) || 15;
    const runAudit = body.runAudit !== false;
    const sessionId = String(body.sessionId || `dsc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

    // Register session for pause/resume/cancel
    createSession(sessionId);

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (event: any) => {
      try {
        const payload = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch (_) {
        // Client connection closed
      }
    };

    // Handle client disconnect
    req.signal.addEventListener("abort", () => {
      console.log(`[Discovery Stream] Client aborted request for session ${sessionId}`);
      removeSession(sessionId);
    });

    // Run execution in background stream
    (async () => {
      const searchRecordId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      try {
        // Determine corridor list strictly respecting operator choice
        const isMultiCorridor = location === "ALL_AHMEDABAD" || location === "ALL_GUJARAT" || body.multiCorridor === true;
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

        // Create initial search record in database
        await db.insert(searches).values({
          id: searchRecordId,
          industry,
          location,
          targetCount,
          status: "running",
          candidatesFound: 0,
          qualifiedCount: 0,
          startedAt: new Date(),
        });

        await sendEvent({
          type: "session_init",
          sessionId,
          industry,
          location,
          targetCount,
          totalCorridors: corridors.length,
          corridors,
          message: `Discovery session initialized across ${corridors.length} corridor(s). Target: ${targetCount} leads.`,
        });

        let qualifiedCount = 0;
        let totalSaved = 0;
        const seenFirms = new Set<string>();
        const leadsNeedingEnrichment: Array<{ candidateId: string; businessName: string; city: string }> = [];
        const perCorridorLimit = Math.max(Math.ceil(targetCount / corridors.length), 10);

        for (let cIdx = 0; cIdx < corridors.length; cIdx++) {
          if (await waitIfPaused(sessionId)) {
            await sendEvent({
              type: "cancelled",
              message: "Discovery cancelled by operator. Saved leads retained.",
              data: { totalSaved, qualifiedCount },
            });
            break;
          }

          const currentCorridor = corridors[cIdx];
          await sendEvent({
            type: "corridor_start",
            corridorIndex: cIdx + 1,
            totalCorridors: corridors.length,
            corridorName: currentCorridor,
            message: `[Corridor ${cIdx + 1}/${corridors.length}] Scanning ${currentCorridor}...`,
          });

          // 1. Scrape Google Maps for this corridor
          const rawPlaces = await searchGoogleMaps(
            industry,
            currentCorridor,
            perCorridorLimit,
            sessionId,
            async (pEvent) => {
              await sendEvent({
                type: pEvent.type,
                corridorIndex: cIdx + 1,
                totalCorridors: corridors.length,
                corridorName: currentCorridor,
                message: pEvent.message,
                data: pEvent.data,
              });
            }
          );

          if (await waitIfPaused(sessionId)) {
            await sendEvent({
              type: "cancelled",
              message: "Discovery cancelled by operator during scraping.",
              data: { totalSaved, qualifiedCount },
            });
            break;
          }

          // Fallback to Bing if Google Maps returned fewer than 3 listings
          let combinedPlaces = [...rawPlaces];
          if (combinedPlaces.length < 3) {
            await sendEvent({
              type: "bing_fallback_start",
              message: `Maps returned ${combinedPlaces.length} listings. Querying public directory fallback...`,
            });
            const fallback = await searchBing(industry, currentCorridor, 8);
            combinedPlaces = [...combinedPlaces, ...fallback];
          }

          await sendEvent({
            type: "corridor_extracted",
            message: `Extracted ${combinedPlaces.length} potential studio listings in ${currentCorridor}. Starting evaluation...`,
            data: { count: combinedPlaces.length },
          });

          // 2. Process, Audit & Save Each Studio IMMEDIATELY in Real-Time
          for (let sIdx = 0; sIdx < combinedPlaces.length; sIdx++) {
            if (await waitIfPaused(sessionId)) break;

            const item = combinedPlaces[sIdx];
            const firmKey = item.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");

            // Skip duplicates
            if (seenFirms.has(firmKey) || firmKey.length < 3) {
              continue;
            }
            seenFirms.add(firmKey);

            // Audit Website if available and enabled
            let directEmail = item.email;
            let linkedInUrl = item.linkedInUrl;
            let commercialTags = item.commercialTags || [];
            let hasCommercialFocus = item.hasCommercialFocus !== false;

            if (runAudit && item.url) {
              await sendEvent({
                type: "audit_start",
                message: `[Audit ${sIdx + 1}/${combinedPlaces.length}] Auditing live portfolio: ${item.businessName}`,
                data: {
                  current: sIdx + 1,
                  total: combinedPlaces.length,
                  studio: item.businessName,
                  url: item.url,
                },
              });

              try {
                const audit = await auditCandidateWebsite(item.url);
                directEmail = audit.email || directEmail;
                linkedInUrl = audit.linkedInUrl || linkedInUrl;
                commercialTags = audit.commercialTags || [];
                hasCommercialFocus = audit.hasCommercialFocus;

                await sendEvent({
                  type: "audit_complete",
                  message: `Audited ${item.businessName}: ${directEmail || "No email"} | ${commercialTags.length} commercial tags`,
                  data: {
                    studio: item.businessName,
                    email: directEmail,
                    linkedIn: linkedInUrl,
                    tags: commercialTags,
                    isCommercial: hasCommercialFocus,
                  },
                });
              } catch (_) {
                // If website fails or times out, proceed with maps data
              }
            }

            if (await waitIfPaused(sessionId)) break;

            // 3. Evaluate Lead Score (5D Model)
            const scoring = evaluateModularLeadScore({
              businessName: item.businessName,
              category: item.category,
              city: item.city,
              phone: item.phone,
              email: directEmail,
              website: item.url,
              rating: item.rating,
              reviewCount: item.reviewCount,
              hasCommercialFocus,
              portfolioTags: commercialTags,
            });

            if (scoring.leadTier === "A+" || scoring.leadTier === "A") {
              qualifiedCount++;
            }

            // 4. Deduplicate against existing PostgreSQL records before inserting
            const existingLeads = await db
              .select({ id: candidates.id, businessName: candidates.businessName })
              .from(candidates)
              .where(eq(candidates.businessName, item.businessName))
              .limit(1);

            let candidateId: string;
            if (existingLeads.length > 0) {
              candidateId = existingLeads[0].id;
              await db.update(candidates)
                .set({
                  email: directEmail || undefined,
                  phone: item.phone && item.phone !== "-" ? item.phone : undefined,
                  website: item.url || undefined,
                  totalScore: scoring.totalScore,
                  leadTier: scoring.leadTier,
                  fitScore: scoring.fitScore,
                  scaleScore: scoring.scaleScore,
                  hasCommercialFocus,
                  updatedAt: new Date(),
                })
                .where(eq(candidates.id, candidateId));
            } else {
              candidateId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const decisionMakers = linkedInUrl
                ? JSON.stringify([{ name: item.businessName, linkedin: linkedInUrl }])
                : null;

              await db.insert(candidates).values({
                id: candidateId,
                searchId: searchRecordId,
                businessName: item.businessName,
                industry,
                category: item.category,
                city: item.city,
                address: item.address,
                phone: item.phone || "-",
                email: directEmail || null,
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
                portfolioTags: commercialTags.length > 0 ? JSON.stringify(commercialTags) : null,
                hasCommercialFocus,
                decisionMakers,
                status: "NEW",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // 5. Generate Online Outreach Copy Draft
            const copy = generateModularOutreach({
              businessName: item.businessName,
              category: item.category,
              city: item.city,
              phone: item.phone,
              recommendedHook: scoring.recommendedHook,
              portfolioTags: commercialTags,
            });

            await db.insert(outreachMessages).values({
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

            totalSaved++;

            // Track candidate if phone is missing for automatic Stage 2 Knowledge Panel enrichment
            if (!item.phone || item.phone === "-" || item.phone === "–" || item.phone.trim() === "") {
              leadsNeedingEnrichment.push({
                candidateId,
                businessName: item.businessName,
                city: item.city,
              });
            }

            // Log initial event into candidate event timeline
            try {
              await db.insert(candidateEvents).values({
                id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                candidateId,
                eventType: "LEAD_CAPTURED",
                title: "Specifier Discovered via Google Maps",
                description: `Discovered in ${currentCorridor}. Fit Score: ${scoring.fitScore} · Tier ${scoring.leadTier}`,
                channel: "SYSTEM",
                metadata: { corridor: currentCorridor, tier: scoring.leadTier, score: scoring.totalScore },
                actor: "Lead Engine Scraper",
                createdAt: new Date(),
              });
            } catch (_) {}

            // 6. Emit Real-Time Progress Update to Client
            await sendEvent({
              type: "lead_saved",
              candidateId,
              businessName: item.businessName,
              leadTier: scoring.leadTier,
              totalScore: scoring.totalScore,
              category: item.category,
              phone: item.phone,
              email: directEmail,
              website: item.url,
              linkedInUrl,
              tags: commercialTags,
              isCommercial: hasCommercialFocus,
              totalSaved,
              qualifiedCount,
              targetCount,
              message: `Saved [Tier ${scoring.leadTier} · ${scoring.totalScore} pts] ${item.businessName}`,
            });

            if (totalSaved >= targetCount) {
              break;
            }
          }

          if (totalSaved >= targetCount) {
            break;
          }
        }

        // Stage 2: Automatic Direct Google Maps Knowledge Panel Phone Enrichment
        if (leadsNeedingEnrichment.length > 0) {
          await sendEvent({
            type: "enrichment_start",
            count: leadsNeedingEnrichment.length,
            message: `Stage 2: Automatically enriching phone numbers via Google Maps knowledge panels for ${leadsNeedingEnrichment.length} studios...`,
          });

          for (let eIdx = 0; eIdx < leadsNeedingEnrichment.length; eIdx++) {
            if (await waitIfPaused(sessionId)) break;
            const targetLead = leadsNeedingEnrichment[eIdx];

            await sendEvent({
              type: "enrichment_item_start",
              current: eIdx + 1,
              total: leadsNeedingEnrichment.length,
              businessName: targetLead.businessName,
              message: `[Enrich ${eIdx + 1}/${leadsNeedingEnrichment.length}] Querying Knowledge Panel: ${targetLead.businessName}`,
            });

            try {
              const enriched = await enrichLeadPhoneFromGoogleMaps(targetLead.businessName, targetLead.city);
              if (enriched.phone) {
                // Update candidate in database
                await db.update(candidates)
                  .set({
                    phone: enriched.phone,
                    address: enriched.address || undefined,
                    website: enriched.website || undefined,
                    enrichmentStatus: "ENRICHED",
                    updatedAt: new Date(),
                  })
                  .where(eq(candidates.id, targetLead.candidateId));

                // Log timeline event
                await db.insert(candidateEvents).values({
                  id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  candidateId: targetLead.candidateId,
                  eventType: "PHONE_ENRICHED",
                  title: "Phone Enriched via Google Maps",
                  description: `Discovered verified number: ${enriched.phone}`,
                  channel: "SYSTEM",
                  metadata: { phone: enriched.phone, address: enriched.address },
                  actor: "Lead Engine Enricher",
                  createdAt: new Date(),
                });

                await sendEvent({
                  type: "lead_enriched",
                  candidateId: targetLead.candidateId,
                  businessName: targetLead.businessName,
                  phone: enriched.phone,
                  message: `Enriched ${targetLead.businessName}: ${enriched.phone}`,
                });
              } else {
                // Incomplete contact details routed to lost leads
                await db.update(candidates)
                  .set({
                    qualificationStage: "LOST",
                    enrichmentStatus: "FAILED",
                    operatorNotes: "Incomplete contact details (no phone found after knowledge panel lookup)",
                    updatedAt: new Date(),
                  })
                  .where(eq(candidates.id, targetLead.candidateId));

                await sendEvent({
                  type: "lead_incomplete",
                  candidateId: targetLead.candidateId,
                  businessName: targetLead.businessName,
                  message: `No verified phone found for ${targetLead.businessName} (moved to Lost Leads)`,
                });
              }
            } catch (err: any) {
              console.error(`[Enrichment Error for ${targetLead.businessName}]:`, err);
            }
          }
        }

        // Finalize search record
        await db.update(searches)
          .set({
            status: "completed",
            candidatesFound: totalSaved,
            qualifiedCount,
            completedAt: new Date(),
          })
          .where(eq(searches.id, searchRecordId));

        await sendEvent({
          type: "complete",
          sessionId,
          totalSaved,
          qualifiedCount,
          targetCount,
          message: `Discovery & Contact Enrichment finished! Saved ${totalSaved} commercial studios (${qualifiedCount} Tier A+/A Specifiers).`,
        });

      } catch (err: any) {
        console.error("[Discovery Stream Error]:", err);
        await sendEvent({
          type: "error",
          error: err.message || "Discovery process failed",
        });
      } finally {
        removeSession(sessionId);
        try {
          await writer.close();
        } catch (_) {}
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
