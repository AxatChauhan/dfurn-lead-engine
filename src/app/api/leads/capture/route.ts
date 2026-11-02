import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { eq } from "drizzle-orm";

function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const businessName = String(body.businessName || body.companyName || body.clientName || "").trim();
    const contactPerson = String(body.contactPerson || body.name || body.fullName || "").trim();
    const rawPhone = String(body.phone || body.phoneNumber || body.mobile || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const city = String(body.city || "Ahmedabad").trim();
    const state = String(body.state || "Gujarat").trim();
    const category = String(body.category || "Commercial Office").trim();
    const projectType = String(body.projectType || "Modular Workstations").trim();
    const workstationCount = body.workstationCount ? parseInt(body.workstationCount, 10) : undefined;
    const projectTimeline = body.projectTimeline ? String(body.projectTimeline).trim() : "1-2 months";
    const hasFloorPlan = Boolean(body.hasFloorPlan);
    const estimatedBudget = body.estimatedBudget ? String(body.estimatedBudget).trim() : undefined;
    const leadSource = String(body.leadSource || body.source || "paid_ads_meta").trim();
    const campaignName = body.campaignName || body.campaign || undefined;
    const utmSource = body.utmSource || body.utm_source || undefined;
    const utmMedium = body.utmMedium || body.utm_medium || undefined;
    const utmCampaign = body.utmCampaign || body.utm_campaign || undefined;
    const notes = body.notes || body.requirementDetails || undefined;

    if (!rawPhone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const phone = normalizeIndianPhone(rawPhone);
    const displayName = businessName || contactPerson || `Lead from ${city}`;

    // Dedup check by phone
    const existing = db
      .select()
      .from(candidates)
      .where(eq(candidates.phone, phone))
      .get();

    if (existing) {
      // Update existing lead with latest campaign touchpoint
      db.update(candidates)
        .set({
          operatorNotes: notes
            ? `${existing.operatorNotes ? existing.operatorNotes + " · " : ""}[New Ad Submit]: ${notes}`
            : existing.operatorNotes,
          campaignName: campaignName || existing.campaignName,
          workstationCount: workstationCount ?? existing.workstationCount,
          hasFloorPlan: hasFloorPlan || existing.hasFloorPlan,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, existing.id))
        .run();

      return NextResponse.json({
        success: true,
        isExisting: true,
        leadId: existing.id,
        message: `Existing lead updated with new inquiry details. Stage: ${existing.qualificationStage}`,
      });
    }

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    db.insert(candidates)
      .values({
        id: leadId,
        businessName: displayName,
        contactPerson: contactPerson || undefined,
        phone,
        email,
        city,
        state,
        category,
        projectType,
        workstationCount: workstationCount ?? null,
        projectTimeline,
        hasFloorPlan,
        estimatedBudget,
        leadSource,
        campaignName,
        utmSource,
        utmMedium,
        utmCampaign,
        qualificationStage: "NEW",
        operatorNotes: notes || `Direct ad inquiry for ${projectType} in ${city}`,
        whatsappAvailable: true,
        hasCommercialFocus: true,
        status: "NEW",
        totalScore: 80,
        leadTier: "A",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    return NextResponse.json(
      {
        success: true,
        isExisting: false,
        leadId,
        message: "New ad lead captured successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Leads Capture API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to capture lead" },
      { status: 500 }
    );
  }
}
