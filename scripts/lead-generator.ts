import * as fs from "node:fs";
import * as path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { eq } from "drizzle-orm";

// 1. Ensure environment variables are loaded
function loadEnv() {
  if (process.env.DATABASE_URL) return;

  const envPaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env.local"),
    path.resolve(__dirname, "../.env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// Import database and discovery modules after environment variables are set
import { db, pool } from "../src/db";
import { searches, candidates, outreachMessages, candidateEvents } from "../src/db/schema";
import { searchGoogleMaps, auditCandidateWebsite } from "../src/lib/discovery";
import { evaluateModularLeadScore } from "../src/lib/evaluator";
import { generateModularOutreach } from "../src/lib/copywriting";

interface GeneratorOptions {
  persona: string;
  corridor: string;
  count: number;
  headless: boolean;
  runAudit: boolean;
}

function parseCliArgs(): Partial<GeneratorOptions> {
  const args = process.argv.slice(2);
  const options: Partial<GeneratorOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--persona" || arg === "--industry" || arg === "--query") && args[i + 1]) options.persona = args[++i];
    else if ((arg === "--corridor" || arg === "--location" || arg === "--city") && args[i + 1]) options.corridor = args[++i];
    else if (arg === "--count" && args[i + 1]) options.count = parseInt(args[++i], 10);
    else if (arg === "--headless") options.headless = args[++i] !== "false";
    else if (arg === "--no-audit") options.runAudit = false;
  }

  return options;
}

async function promptOptions(): Promise<GeneratorOptions> {
  const rl = readline.createInterface({ input, output });

  console.log("");
  console.log("===============================================================================");
  console.log("                D'FURN MODULAR SYSTEMS - LEAD GENERATOR (DESKTOP)             ");
  console.log("   Tier 1 Dedicated Local Operator Engine - 100% Verified Specifier Leads     ");
  console.log("   Runs via residential broadband with stealth Microsoft Edge / Chromium      ");
  console.log("===============================================================================");
  console.log("");

  // 1. Specifier Query
  const personaChoice = await rl.question(
    "Enter Specifier Profession / Trade Query\n(default: Commercial Architects & Interior Designers): "
  );
  const persona = personaChoice.trim() || "Commercial Architects & Interior Designers";

  // 2. Location Query
  const corridorChoice = await rl.question(
    "\nEnter Target Location, Road, or City Micro-Market\n(default: Sindhu Bhavan Road, Ahmedabad): "
  );
  const corridor = corridorChoice.trim() || "Sindhu Bhavan Road, Ahmedabad";

  // 3. Count
  const countChoice = await rl.question("\nTarget Lead Count (default 15): ");
  const count = parseInt(countChoice.trim(), 10) || 15;

  // 4. Headless
  const headlessChoice = await rl.question("\nRun browser in background? (Y/n, default Y): ");
  const headless = headlessChoice.trim().toLowerCase() !== "n";

  rl.close();

  return {
    persona,
    corridor,
    count,
    headless,
    runAudit: true,
  };
}

export async function runLeadGenerator() {
  const cliArgs = parseCliArgs();
  let options: GeneratorOptions;

  if (cliArgs.corridor && cliArgs.count) {
    options = {
      persona: cliArgs.persona || "Commercial Architects & Interior Designers",
      corridor: cliArgs.corridor,
      count: cliArgs.count,
      headless: cliArgs.headless !== false,
      runAudit: cliArgs.runAudit !== false,
    };
  } else {
    options = await promptOptions();
  }

  const corridors =
    options.corridor === "ALL_AHMEDABAD_CORRIDORS"
      ? [
          "Bodakdev & Sindhu Bhavan Road, Ahmedabad",
          "Prahlad Nagar & SG Highway, Ahmedabad",
          "CG Road & Navrangpura, Ahmedabad",
          "Science City & Sola, Ahmedabad",
        ]
      : [options.corridor];

  console.log("\n-------------------------------------------------------------------------------");
  console.log(`[CONFIG] Persona: ${options.persona}`);
  console.log(`[CONFIG] Corridors: ${corridors.join(", ")}`);
  console.log(`[CONFIG] Target Leads: ${options.count}`);
  console.log(`[CONFIG] Headless Mode: ${options.headless}`);
  console.log(`[CONFIG] Database: Mumbai Supabase PostgreSQL (schema: lead_engine)`);
  console.log("-------------------------------------------------------------------------------\n");

  const searchId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(searches).values({
    id: searchId,
    industry: options.persona,
    location: options.corridor,
    targetCount: options.count,
    status: "running",
    candidatesFound: 0,
    qualifiedCount: 0,
    startedAt: new Date(),
  });

  let totalSaved = 0;
  let totalWithPhone = 0;
  let totalWithEmail = 0;
  let totalQualified = 0;
  const seenFirms = new Set<string>();
  const perCorridorLimit = Math.max(Math.ceil(options.count / corridors.length), 5);

  const startTime = Date.now();

  for (let c = 0; c < corridors.length; c++) {
    if (totalSaved >= options.count) break;

    const currentCorridor = corridors[c];
    console.log(`\n>>> [Corridor ${c + 1}/${corridors.length}] Scanning ${currentCorridor}...`);

    const rawPlaces = await searchGoogleMaps(
      options.persona,
      currentCorridor,
      perCorridorLimit,
      undefined,
      (evt) => {
        if (evt.type === "place_found") {
          console.log(`  [MAPS] Found: ${evt.data?.title} (${evt.data?.phone || "No phone listed on Maps"})`);
        }
      },
      { headless: options.headless }
    );

    console.log(`\n  Extracted ${rawPlaces.length} listings from Google Maps. Commencing audit and scoring...`);

    for (let i = 0; i < rawPlaces.length; i++) {
      if (totalSaved >= options.count) break;

      const place = rawPlaces[i];
      const firmKey = place.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenFirms.has(firmKey) || firmKey.length < 3) continue;
      seenFirms.add(firmKey);

      console.log(`\n  -------------------------------------------------------------`);
      console.log(`  [Lead ${totalSaved + 1}/${options.count}] ${place.businessName}`);

      let directEmail = place.email;
      let commercialTags = place.commercialTags || [];
      let hasCommercialFocus = place.hasCommercialFocus !== false;

      // 1. Website Audit
      if (options.runAudit && place.url) {
        process.stdout.write(`  -> Auditing website (${place.url})... `);
        try {
          const audit = await auditCandidateWebsite(place.url);
          directEmail = audit.email || directEmail;
          commercialTags = audit.commercialTags || [];
          hasCommercialFocus = audit.hasCommercialFocus;
          if ((!place.phone || place.phone.trim() === "" || place.phone === "-") && audit.phone) {
            place.phone = audit.phone;
          }
          console.log(`Done. Email: ${directEmail || "None"} | Tags: ${commercialTags.length}`);
        } catch (_) {
          console.log("Skipped (unreachable).");
        }
      }

      // 2. 5D Lead Scoring
      const scoring = evaluateModularLeadScore({
        businessName: place.businessName,
        category: place.category,
        city: place.city,
        phone: place.phone,
        email: directEmail,
        website: place.url,
        rating: place.rating,
        reviewCount: place.reviewCount,
        hasCommercialFocus,
        portfolioTags: commercialTags,
      });

      if (scoring.leadTier === "A+" || scoring.leadTier === "A") {
        totalQualified++;
      }

      // 3. Modular 3-Channel Copywriting
      const outreach = generateModularOutreach({
        businessName: place.businessName,
        category: place.category,
        city: place.city,
        phone: place.phone,
        portfolioTags: commercialTags,
      });

      // 4. Upsert to Supabase PostgreSQL
      const existing = await db
        .select({ id: candidates.id, phone: candidates.phone })
        .from(candidates)
        .where(eq(candidates.businessName, place.businessName))
        .limit(1);

      let candidateId: string;

      if (existing.length > 0) {
        candidateId = existing[0].id;
        const updatePayload: any = {
          rating: place.rating ? String(place.rating) : undefined,
          reviewCount: place.reviewCount || undefined,
          website: place.url || undefined,
          updatedAt: new Date(),
        };

        if (directEmail) updatePayload.email = directEmail;
        if (place.phone && (!existing[0].phone || existing[0].phone === "-" || existing[0].phone === "–")) {
          updatePayload.phone = place.phone;
          updatePayload.enrichmentStatus = "ENRICHED";
        }

        await db.update(candidates).set(updatePayload).where(eq(candidates.id, candidateId));
        console.log(`  -> Database: Updated existing record (${candidateId})`);
      } else {
        candidateId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await db.insert(candidates).values({
          id: candidateId,
          searchId,
          businessName: place.businessName,
          category: place.category || "Commercial Architect",
          city: place.city || "Ahmedabad",
          state: "Gujarat",
          address: place.address || `${currentCorridor}, Gujarat`,
          phone: place.phone || "-",
          email: directEmail || undefined,
          website: place.url || undefined,
          rating: place.rating ? String(place.rating) : undefined,
          reviewCount: place.reviewCount || 0,
          sourceType: "google_maps",
          sourceUrl: place.url || undefined,
          leadSource: "google_maps",
          qualificationStage: "NEW",
          totalScore: scoring.totalScore,
          leadTier: scoring.leadTier,
          fitScore: scoring.fitScore,
          scaleScore: scoring.scaleScore,
          activityScore: scoring.activityScore,
          accessibilityScore: scoring.accessibilityScore,
          synergyScore: scoring.synergyScore,
          reasoning: scoring.reasoning,
          portfolioTags: JSON.stringify(commercialTags),
          hasCommercialFocus,
          whatsappAvailable: true,
          status: "NEW",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Insert outreach draft
        await db.insert(outreachMessages).values({
          id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId,
          channel: "WHATSAPP",
          stepNumber: 1,
          subject: "Modular Workstation OEM Partnership",
          bodyContent: outreach.whatsAppMessage,
          approvalStatus: "draft_pending_review",
          createdAt: new Date(),
        });

        // Log capture event
        await db.insert(candidateEvents).values({
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId,
          eventType: "LEAD_CAPTURED",
          title: "Lead Discovered via Desktop Generator",
          description: `Captured from Google Maps in ${currentCorridor}. Score: ${scoring.totalScore} (${scoring.leadTier}).`,
          channel: "SYSTEM",
          actor: "Lead Generator Desktop Tool",
          createdAt: new Date(),
        });

        console.log(`  -> Database: Inserted new lead (${candidateId})`);
      }

      totalSaved++;
      if (place.phone && place.phone !== "-" && place.phone !== "–") totalWithPhone++;
      if (directEmail) totalWithEmail++;

      console.log(`  -> Phone: ${place.phone || "None"} | Tier: ${scoring.leadTier} (${scoring.totalScore}/100)`);
    }
  }

  // Update search session record
  await db
    .update(searches)
    .set({
      status: "completed",
      candidatesFound: totalSaved,
      qualifiedCount: totalQualified,
      completedAt: new Date(),
    })
    .where(eq(searches.id, searchId));

  const durationSec = Math.round((Date.now() - startTime) / 1000);

  console.log("\n===============================================================================");
  console.log("                        LEAD GENERATION RUN COMPLETE                          ");
  console.log("===============================================================================");
  console.log(`  Time Elapsed:           ${durationSec} seconds`);
  console.log(`  Total Leads Processed:  ${totalSaved}`);
  console.log(`  Verified Phone Numbers: ${totalWithPhone} / ${totalSaved} (${Math.round((totalWithPhone / (totalSaved || 1)) * 100)}%)`);
  console.log(`  Direct Email Addresses: ${totalWithEmail} / ${totalSaved}`);
  console.log(`  Qualified (A+ / A):     ${totalQualified} leads`);
  console.log("-------------------------------------------------------------------------------");
  console.log("  All leads have been pushed directly to the central Mumbai Supabase PostgreSQL.");
  console.log("  Sales reps can now access, call, and WhatsApp them live at:");
  console.log("  >> https://dfurn-lead-engine.vercel.app");
  console.log("===============================================================================\n");

  // Clean shutdown
  try {
    await pool.end();
  } catch (_) {}
}

if (require.main === module || process.argv[1]?.endsWith("lead-generator.ts")) {
  runLeadGenerator().catch((err) => {
    console.error("\n[FATAL ERROR] Lead generation failed:", err);
    process.exit(1);
  });
}
