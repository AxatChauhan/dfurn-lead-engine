import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, candidateEvents, rejectedLeads } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { normalizePhoneDigits, normalizeFirmName, cleanLeadCategory } from "@/lib/dedup";
import { logCandidateEvent } from "@/lib/events";

/**
 * Lead Deduplication & Database Sanitization API
 * Detects existing duplicates, merges multi-touch history, and re-indexes records.
 * Strictly zero em dashes.
 */

// Progression ranking for selecting the canonical primary candidate
const STAGE_RANK: Record<string, number> = {
  QUALIFIED: 5,
  FOLLOW_UP: 4,
  CONTACTED: 3,
  NEW: 1,
  DISQUALIFIED: 2,
};

export async function POST(req: NextRequest) {
  try {
    const allCandidates = await db.select().from(candidates);

    // Group by normalized phone
    const phoneGroups = new Map<string, typeof allCandidates>();
    for (const c of allCandidates) {
      const normPhone = normalizePhoneDigits(c.phone);
      if (normPhone && normPhone.length >= 8) {
        if (!phoneGroups.has(normPhone)) phoneGroups.set(normPhone, []);
        phoneGroups.get(normPhone)!.push(c);
      }
    }

    const mergedGroups: any[] = [];
    const idsToDelete: string[] = [];

    for (const [normPhone, group] of phoneGroups.entries()) {
      if (group.length <= 1) continue;

      // Sort to find the best primary record
      group.sort((a, b) => {
        const rankA = STAGE_RANK[a.qualificationStage || "NEW"] || 1;
        const rankB = STAGE_RANK[b.qualificationStage || "NEW"] || 1;
        if (rankA !== rankB) return rankB - rankA;

        // Next tiebreaker: notes length
        const notesLenA = (a.operatorNotes || "").length;
        const notesLenB = (b.operatorNotes || "").length;
        if (notesLenA !== notesLenB) return notesLenB - notesLenA;

        // Earliest created
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const primary = group[0];
      const duplicates = group.slice(1);

      const duplicateNames = duplicates.map((d) => d.businessName).join(", ");
      const combinedNotes = duplicates
        .map((d) => d.operatorNotes)
        .filter(Boolean)
        .join(" · ");

      const aliasNote = `[Dedup Merged]: Secondary identities (${duplicateNames}) sharing phone ${primary.phone}${
        combinedNotes ? ` · Prior notes: ${combinedNotes}` : ""
      }`;

      const updatedNotes = primary.operatorNotes
        ? `${primary.operatorNotes} · ${aliasNote}`
        : aliasNote;

      const cleanCat = cleanLeadCategory(primary.category);

      // Update primary record
      await db
        .update(candidates)
        .set({
          operatorNotes: updatedNotes,
          category: cleanCat,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, primary.id));

      // Re-assign events from duplicates to primary
      for (const dup of duplicates) {
        idsToDelete.push(dup.id);
        try {
          await db
            .update(candidateEvents)
            .set({ candidateId: primary.id })
            .where(eq(candidateEvents.candidateId, dup.id));
        } catch (_) {}
      }

      // Log audit event on primary
      await logCandidateEvent({
        candidateId: primary.id,
        eventType: "NOTE_UPDATED",
        title: "Deduplication Merge Executed",
        description: `Consolidated ${duplicates.length} duplicate record(s): ${duplicateNames}. Retained stage '${primary.qualificationStage}'.`,
        channel: "SYSTEM",
        actor: "Dedup Engine",
        metadata: {
          primaryId: primary.id,
          normalizedPhone: normPhone,
          mergedDuplicateIds: duplicates.map((d) => d.id),
        },
      });

      mergedGroups.push({
        primaryId: primary.id,
        primaryName: primary.businessName,
        phone: primary.phone,
        mergedCount: duplicates.length,
        mergedIdentities: duplicateNames,
      });
    }

    // Delete redundant duplicate candidate rows
    if (idsToDelete.length > 0) {
      await db.delete(candidates).where(inArray(candidates.id, idsToDelete));
    }

    // Category sanitization across all remaining candidates (fixing 'akshar sqaure', etc.)
    const remaining = await db.select().from(candidates);
    let categoriesCleaned = 0;
    for (const c of remaining) {
      const cleanCat = cleanLeadCategory(c.category);
      if (cleanCat !== c.category) {
        await db
          .update(candidates)
          .set({ category: cleanCat, updatedAt: new Date() })
          .where(eq(candidates.id, c.id));
        categoriesCleaned++;
      }
    }

    // Purge/Archive leads with missing phone numbers into rejected_leads
    const uncallableLeads = remaining.filter(
      (c) => !c.phone || c.phone.trim() === "-" || c.phone.trim() === "" || c.phone.toLowerCase() === "no phone"
    );
    let archivedNoPhoneCount = 0;
    for (const u of uncallableLeads) {
      try {
        await db.insert(rejectedLeads).values({
          id: `rej_nophone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          businessName: u.businessName,
          contactPerson: u.contactPerson || undefined,
          phone: undefined,
          city: u.city || "Ahmedabad",
          category: u.category || "Commercial Entity",
          leadSource: u.leadSource || "google_maps",
          rejectionReason: "NO_PHONE_NUMBER",
          notes: "Archived: Scraped entity missing direct callable telephone number",
          rejectedAt: new Date(),
        });
        await db.delete(candidates).where(eq(candidates.id, u.id));
        archivedNoPhoneCount++;
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      mergedGroupsCount: mergedGroups.length,
      deletedDuplicateRows: idsToDelete.length,
      categoriesCleaned,
      archivedNoPhoneCount,
      mergedSummary: mergedGroups,
    });
  } catch (error: any) {
    console.error("[Dedup Route] Error:", error);
    return NextResponse.json(
      { error: "Failed to run deduplication cleanup", details: error.message },
      { status: 500 }
    );
  }
}
