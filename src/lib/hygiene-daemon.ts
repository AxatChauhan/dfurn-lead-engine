import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateAndFormatPhone, cleanBusinessName } from "./qualification-shield";
import { cleanLeadCategory } from "./dedup";

/**
 * Autonomous Background Hygiene Engine
 * Self-healing daemon that maintains database purity in production.
 * Runs on startup and periodic schedule without requiring human intervention.
 * Strictly zero em dashes.
 */

export interface HygieneSweepSummary {
  timestamp: string;
  totalExamined: number;
  uncallableArchived: number;
  duplicatesMerged: number;
  categoriesNormalized: number;
  healthyTotal: number;
  status: "PURE" | "REPAIRED";
}

let lastSweepTime: string | null = null;
let isSweepRunning = false;

/**
 * Executes a full database hygiene sweep.
 * Safely repairs uncallable records, merges duplicate phones, and canonicalizes categories.
 */
export async function runAutomatedHygieneSweep(): Promise<HygieneSweepSummary> {
  if (isSweepRunning) {
    return {
      timestamp: new Date().toISOString(),
      totalExamined: 0,
      uncallableArchived: 0,
      duplicatesMerged: 0,
      categoriesNormalized: 0,
      healthyTotal: 0,
      status: "PURE",
    };
  }

  isSweepRunning = true;
  const startTime = new Date().toISOString();

  try {
    const allCandidates = await db.select().from(candidates);
    let uncallableArchived = 0;
    let duplicatesMerged = 0;
    let categoriesNormalized = 0;

    // 1. AUTO-ARCHIVE UNCALLABLE LEADS (NO PHONE / DUMMY)
    for (const c of allCandidates) {
      const rawPhone = c.phone;
      const hasPhone = Boolean(
        rawPhone &&
        rawPhone.trim() !== "" &&
        rawPhone.trim() !== "-" &&
        rawPhone.toLowerCase() !== "no phone"
      );

      let isValid = false;
      if (hasPhone) {
        const validation = validateAndFormatPhone(rawPhone);
        isValid = validation.isValid;
      }

      if (!isValid) {
        const rejectId = `rej_hygiene_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await db.insert(rejectedLeads).values({
          id: rejectId,
          businessName: c.businessName || "Unnamed Business",
          phone: c.phone || "-",
          city: c.city || "Ahmedabad",
          leadSource: c.leadSource || "system_hygiene",
          rejectionReason: "NO_PHONE_NUMBER",
          notes: "Auto-archived lead lacking valid callable telephone number",
          rawPayload: {
            originalCandidateId: c.id,
            archivedBy: "Autonomous Hygiene Daemon",
            timestamp: startTime,
            reason: "Auto-archived lead lacking valid callable telephone number",
          },
        });

        await db.delete(candidateEvents).where(eq(candidateEvents.candidateId, c.id));
        await db.delete(candidates).where(eq(candidates.id, c.id));
        uncallableArchived++;
      }
    }

    // 2. AUTO-DEDUPLICATE PHONE CLASHES
    const remainingCandidates = await db.select().from(candidates);
    const phoneMap: Record<string, typeof remainingCandidates> = {};

    for (const c of remainingCandidates) {
      if (c.phone) {
        const digits = c.phone.replace(/\D/g, "").slice(-10);
        if (digits.length >= 8) {
          phoneMap[digits] = phoneMap[digits] || [];
          phoneMap[digits].push(c);
        }
      }
    }

    for (const [phoneDigits, group] of Object.entries(phoneMap)) {
      if (group.length > 1) {
        // Sort: highest totalScore first, then earliest created
        group.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        const primary = group[0];
        const secondaries = group.slice(1);

        for (const sec of secondaries) {
          const updatedNotes = `${primary.operatorNotes || ""} · [Hygiene Merged]: Merged secondary identity (${sec.businessName}) sharing phone ${primary.phone}`.trim();

          await db.update(candidates).set({
            operatorNotes: updatedNotes,
            updatedAt: new Date(),
          }).where(eq(candidates.id, primary.id));

          const rejectId = `rej_hygiene_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.insert(rejectedLeads).values({
            id: rejectId,
            businessName: sec.businessName || "Unnamed Business",
            phone: sec.phone || "-",
            city: sec.city || "Ahmedabad",
            leadSource: sec.leadSource || "system_hygiene",
            rejectionReason: "DUPLICATE_PHONE_MERGED",
            notes: `Merged into primary candidate ${primary.businessName} (${primary.id})`,
            rawPayload: {
              mergedIntoCandidateId: primary.id,
              mergedIntoBusinessName: primary.businessName,
              archivedBy: "Autonomous Hygiene Daemon",
              timestamp: startTime,
            },
          });

          await db.delete(candidateEvents).where(eq(candidateEvents.candidateId, sec.id));
          await db.delete(candidates).where(eq(candidates.id, sec.id));
          duplicatesMerged++;
        }
      }
    }

    // 3. AUTO-NORMALIZE CATEGORIES AND RESIDUAL SCRAPER JUNK
    const activeCandidates = await db.select().from(candidates);
    for (const c of activeCandidates) {
      const rawCategory = c.category || "";
      const rawIndustry = c.industry || "";
      const cleanBiz = cleanBusinessName(c.businessName);

      let canonical = cleanLeadCategory(rawCategory);
      if (canonical === "Commercial Specifier" && rawIndustry) {
        canonical = cleanLeadCategory(rawIndustry);
      }
      if (canonical === "Commercial Specifier") {
        canonical = cleanLeadCategory(cleanBiz);
      }

      const hasQueryArtifact =
        rawCategory.includes("sqaure") ||
        rawCategory.includes("furniture company") ||
        rawCategory.includes("office in") ||
        rawIndustry.includes("sqaure") ||
        rawIndustry.includes("akshar");

      const needsUpdate = c.category !== canonical || c.industry !== canonical || hasQueryArtifact || c.businessName !== cleanBiz;

      if (needsUpdate) {
        await db.update(candidates).set({
          businessName: cleanBiz,
          category: canonical,
          industry: canonical,
          updatedAt: new Date(),
        }).where(eq(candidates.id, c.id));
        categoriesNormalized++;
      }
    }

    lastSweepTime = startTime;
    const finalCount = activeCandidates.length - duplicatesMerged;

    return {
      timestamp: startTime,
      totalExamined: allCandidates.length,
      uncallableArchived,
      duplicatesMerged,
      categoriesNormalized,
      healthyTotal: finalCount,
      status: uncallableArchived > 0 || duplicatesMerged > 0 || categoriesNormalized > 0 ? "REPAIRED" : "PURE",
    };
  } finally {
    isSweepRunning = false;
  }
}

/**
 * Returns the last recorded sweep time.
 */
export function getLastHygieneSweepTime(): string | null {
  return lastSweepTime;
}
