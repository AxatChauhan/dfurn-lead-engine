import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sanitizeIndianPhone } from "@/lib/discovery";
import { isSuspiciousDummyPhone, isResidentialMismatch } from "@/lib/qualification";
import { parseLeadCsv, ParsedCsvLead } from "@/lib/csv-parser";

export async function POST(req: NextRequest) {
  try {
    let csvText = "";
    let defaultSource = "paid_ads_meta";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No CSV file uploaded in form data." }, { status: 400 });
      }
      csvText = await file.text();
      defaultSource = (formData.get("source") as string) || "paid_ads_meta";
    } else {
      const body = await req.json();
      csvText = body.csvText || body.csvContent || "";
      defaultSource = body.source || body.channel || body.defaultSource || "paid_ads_meta";
    }

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ error: "CSV content is empty." }, { status: 400 });
    }

    const { leads, errors } = parseLeadCsv(csvText, defaultSource);

    if (leads.length === 0) {
      return NextResponse.json(
        {
          error: "No valid lead rows could be extracted from the provided CSV.",
          details: errors,
        },
        { status: 400 }
      );
    }

    let importedCount = 0;
    let dummyCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const lead of leads) {
      // 1. Residential Mismatch Disqualification Gate
      const scopeCheck = `${lead.projectType} ${lead.notes || ""} ${lead.businessName}`;
      if (isResidentialMismatch(scopeCheck)) {
        const rejectId = `rej_${Date.now()}_${nanoid(6)}`;
        await db.insert(rejectedLeads).values({
          id: rejectId,
          businessName: lead.businessName,
          contactPerson: lead.contactPerson || undefined,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          city: lead.city,
          leadSource: lead.leadSource,
          category: "Residential Decorator",
          rejectionReason: "RESIDENTIAL_MISMATCH",
          notes: lead.notes || `Disqualified on CSV import: Scope '${lead.projectType}' is residential`,
          rawPayload: lead.rawRow,
          rejectedAt: new Date(),
        });
        rejectedCount++;
        continue;
      }

      // 2. Dummy Phone Evaluation
      const isDummy = isSuspiciousDummyPhone(lead.phone);
      if (isDummy) dummyCount++;

      const cleanPhone = sanitizeIndianPhone(lead.phone) || lead.phone;

      // 3. Deduplication by Phone
      const [existing] = await db
        .select()
        .from(candidates)
        .where(eq(candidates.phone, cleanPhone));

      if (existing) {
        // Multi-touch attribution update
        const existingSources = (existing.leadSource || "").split(",").map((s) => s.trim());
        const updatedSource = existingSources.includes(lead.leadSource)
          ? existing.leadSource
          : `${existing.leadSource}, ${lead.leadSource}`;

        const appendNotes = lead.notes
          ? `${existing.operatorNotes ? existing.operatorNotes + " · " : ""}[CSV Import Touchpoint]: ${lead.notes}`
          : existing.operatorNotes;

        await db
          .update(candidates)
          .set({
            leadSource: updatedSource,
            campaignName: lead.campaignName || existing.campaignName,
            operatorNotes: appendNotes,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, existing.id));

        await db.insert(candidateEvents).values({
          id: `evt_${nanoid(12)}`,
          candidateId: existing.id,
          eventType: "NOTE_UPDATED",
          title: `Re-engaged via CSV Import (${lead.leadSource})`,
          description: `Prospect re-imported from campaign '${lead.campaignName || "Default"}'. Account deduplicated.`,
          channel: "CSV_IMPORT",
          actor: "CSV_IMPORTER",
          createdAt: new Date(),
        });

        duplicateCount++;
      } else {
        // 4. Create New Candidate
        const candidateId = `cand_${nanoid(12)}`;

        await db.insert(candidates).values({
          id: candidateId,
          businessName: lead.businessName,
          contactPerson: lead.contactPerson || undefined,
          phone: cleanPhone,
          isDummyPhone: isDummy,
          enrichmentStatus: "NONE",
          email: lead.email || undefined,
          city: lead.city || "Ahmedabad",
          state: lead.state || "Gujarat",
          category: "Commercial Specifier",
          projectType: lead.projectType || "Modular Workstations",
          workstationCount: lead.workstationCount,
          leadSource: lead.leadSource,
          campaignName: lead.campaignName || undefined,
          adName: lead.adName || undefined,
          qualificationStage: "NEW",
          leadTier: "A",
          status: "NEW",
          operatorNotes: lead.notes || (isDummy ? "Suspected dummy phone submission for operator review" : undefined),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(candidateEvents).values({
          id: `evt_${nanoid(12)}`,
          candidateId,
          eventType: "LEAD_CAPTURED",
          title: `Lead Imported (${lead.leadSource})`,
          description: `Imported via CSV into portal. Campaign: ${lead.campaignName || "Standard Intake"}. Initial Scope: ${lead.projectType}`,
          channel: "CSV_IMPORT",
          actor: "CSV_IMPORTER",
          createdAt: new Date(),
        });

        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: leads.length,
      importedCount,
      dummyCount,
      rejectedCount,
      duplicateCount,
      parseErrors: errors,
      message: `Processed ${leads.length} leads: ${importedCount} imported as new, ${duplicateCount} merged/updated, ${dummyCount} flagged as dummy phone, ${rejectedCount} residential mismatches preserved in Rejected Leads.`,
    });
  } catch (err: any) {
    console.error("Error importing leads CSV:", err);
    return NextResponse.json({ error: err.message || "Failed to process CSV import" }, { status: 500 });
  }
}
