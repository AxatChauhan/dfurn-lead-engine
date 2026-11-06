import { NextRequest, NextResponse } from "next/server";
import { parseLeadCsv } from "@/lib/csv-parser";
import { ingestCandidateLead } from "@/lib/intake-pipeline";

/**
 * CSV Batch Importer API
 * Routes all uploaded rows strictly through the Universal Intake Gatekeeper.
 * Strictly zero em dashes.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded in form-data" }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      csvText = await req.text();
    }

    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ error: "Empty CSV file provided" }, { status: 400 });
    }

    const { leads, errors } = parseLeadCsv(csvText);

    if (leads.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: "Failed to parse any valid lead records from CSV",
          details: errors,
        },
        { status: 400 }
      );
    }

    let importedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const lead of leads) {
      const ingestRes = await ingestCandidateLead(
        {
          businessName: lead.businessName,
          contactPerson: lead.contactPerson || undefined,
          phone: lead.phone,
          email: lead.email || undefined,
          city: lead.city,
          state: lead.state || "Gujarat",
          category: lead.projectType,
          projectType: lead.projectType || "Modular Workstations",
          workstationCount: lead.workstationCount,
          leadSource: lead.leadSource,
          campaignName: lead.campaignName || undefined,
          adName: lead.adName || undefined,
          notes: lead.notes || undefined,
          sourceType: "csv_import",
        },
        {
          channel: "csv_import",
          actor: "CSV Batch Importer",
        }
      );

      if (!ingestRes.success) {
        rejectedCount++;
      } else if (ingestRes.action === "MERGED") {
        duplicateCount++;
      } else {
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: leads.length,
      importedCount,
      rejectedCount,
      duplicateCount,
      parseErrors: errors,
      message: `Processed ${leads.length} leads: ${importedCount} imported as new, ${duplicateCount} merged/updated without duplicates, ${rejectedCount} disqualified into Rejected Leads.`,
    });
  } catch (err: any) {
    console.error("Error importing leads CSV:", err);
    return NextResponse.json({ error: err.message || "Failed to process CSV import" }, { status: 500 });
  }
}
