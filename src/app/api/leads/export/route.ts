import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).trim();
  // If string contains comma, quote, or newline, escape it
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const source = searchParams.get("source");

    const conditions: any[] = [];
    if (stage && stage !== "ALL") {
      conditions.push(eq(candidates.qualificationStage, stage));
    }
    if (category && category !== "ALL") {
      conditions.push(eq(candidates.category, category));
    }
    if (city && city !== "ALL") {
      conditions.push(eq(candidates.city, city));
    }
    if (source && source !== "ALL") {
      conditions.push(eq(candidates.leadSource, source));
    }

    const query = db.select().from(candidates);
    const rows = conditions.length > 0
      ? query.where(and(...conditions)).orderBy(desc(candidates.createdAt)).all()
      : query.orderBy(desc(candidates.createdAt)).all();

    const headers = [
      "Lead ID",
      "Company / Business Name",
      "Contact Person",
      "Phone Number",
      "Email",
      "City",
      "State",
      "Category",
      "Project Type / Scope",
      "Workstation Count",
      "Floor Plan Available",
      "Project Timeline",
      "Estimated Budget",
      "Lead Source / Channel",
      "Campaign Name",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "Qualification Stage",
      "Operator Notes",
      "Received Date",
      "ERP Sync Status",
      "ERP Enquiry Code",
      "ERP Client Code",
    ];

    const csvLines: string[] = [];
    // Excel UTF-8 BOM so special characters & numbers display cleanly
    csvLines.push("\uFEFF" + headers.map(escapeCsvCell).join(","));

    for (const r of rows) {
      const line = [
        escapeCsvCell(r.id),
        escapeCsvCell(r.businessName),
        escapeCsvCell(r.contactPerson || "–"),
        escapeCsvCell(r.phone || "–"),
        escapeCsvCell(r.email || "–"),
        escapeCsvCell(r.city || "–"),
        escapeCsvCell(r.state || "–"),
        escapeCsvCell(r.category || "Commercial Office"),
        escapeCsvCell(r.projectType || "Modular Workstations"),
        escapeCsvCell(r.workstationCount ?? "–"),
        escapeCsvCell(r.hasFloorPlan ? "Yes" : "No"),
        escapeCsvCell(r.projectTimeline || "–"),
        escapeCsvCell(r.estimatedBudget || "–"),
        escapeCsvCell(r.leadSource || "paid_ads"),
        escapeCsvCell(r.campaignName || "–"),
        escapeCsvCell(r.utmSource || "–"),
        escapeCsvCell(r.utmMedium || "–"),
        escapeCsvCell(r.utmCampaign || "–"),
        escapeCsvCell(r.qualificationStage || "NEW"),
        escapeCsvCell(r.operatorNotes || r.reasoning || "–"),
        escapeCsvCell(r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "–"),
        escapeCsvCell(r.status === "SYNCED_TO_ERP" ? "SYNCED" : "PENDING"),
        escapeCsvCell(r.erpEnquiryCode || "–"),
        escapeCsvCell(r.erpClientCode || "–"),
      ];
      csvLines.push(line.join(","));
    }

    const csvContent = csvLines.join("\r\n");
    const today = new Date().toISOString().split("T")[0];
    const fileName = `dfurn_leads_export_${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[Leads Export API] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to export leads" }, { status: 500 });
  }
}
