import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, rejectedLeads, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeIndianPhone } from "@/lib/discovery";
import { isSuspiciousDummyPhone, isResidentialMismatch } from "@/lib/qualification";

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

    const displayName = businessName || contactPerson || `Lead from ${city}`;

    // 1. Strict Residential Filter: Route explicit residential projects to rejected_leads
    const scopeCheckText = `${projectType} ${notes || ""} ${category}`;
    if (isResidentialMismatch(scopeCheckText)) {
      const rejectId = `rej_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(rejectedLeads).values({
        id: rejectId,
        businessName: displayName,
        contactPerson: contactPerson || undefined,
        phone: rawPhone || undefined,
        email,
        city,
        leadSource,
        category: "Residential Decorator",
        rejectionReason: "RESIDENTIAL_MISMATCH",
        notes: notes || `Project type '${projectType}' does not align with commercial modular furniture`,
        rawPayload: body,
        rejectedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        rejected: true,
        rejectId,
        message: "Submission identified as residential mismatch and preserved in Rejected Leads.",
      }, { status: 200 });
    }

    if (!rawPhone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const isDummyPhone = isSuspiciousDummyPhone(rawPhone);
    const phone = sanitizeIndianPhone(rawPhone) || rawPhone;

    // Dedup check by phone
    const [existing] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.phone, phone));

    if (existing) {
      // Update existing lead with latest campaign touchpoint
      await db.update(candidates)
        .set({
          operatorNotes: notes
            ? `${existing.operatorNotes ? existing.operatorNotes + " · " : ""}[New Ad Submit]: ${notes}`
            : existing.operatorNotes,
          campaignName: campaignName || existing.campaignName,
          workstationCount: workstationCount ?? existing.workstationCount,
          hasFloorPlan: hasFloorPlan || existing.hasFloorPlan,
          isDummyPhone: isDummyPhone || existing.isDummyPhone,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, existing.id));

      await db.insert(candidateEvents).values({
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        candidateId: existing.id,
        eventType: "LEAD_RE_ENGAGED",
        title: "Re-engaged via Ad Campaign",
        description: `Submitted new form via campaign: ${campaignName || "Paid Ad"}`,
        channel: leadSource.includes("google") ? "GOOGLE_ADS" : "META_ADS",
        metadata: { campaignName, utmSource, workstationCount },
        actor: "Ad Webhook",
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        isExisting: true,
        leadId: existing.id,
        message: `Existing lead updated with new inquiry details. Stage: ${existing.qualificationStage}`,
      });
    }

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await db.insert(candidates)
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
        operatorNotes: notes || (isDummyPhone ? "[DUMMY SUBMISSION]: Incomplete or suspicious phone number submitted" : `Direct ad inquiry for ${projectType} in ${city}`),
        whatsappAvailable: !isDummyPhone,
        hasCommercialFocus: true,
        isDummyPhone,
        enrichmentStatus: "NONE",
        status: "NEW",
        totalScore: isDummyPhone ? 40 : 85,
        leadTier: isDummyPhone ? "C" : "A",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    // Insert chronological timeline event
    await db.insert(candidateEvents).values({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      candidateId: leadId,
      eventType: "LEAD_CAPTURED",
      title: isDummyPhone ? "Ad Form Submitted (Flagged Dummy Phone)" : "Inbound Ad Lead Ingested",
      description: `Campaign: ${campaignName || "Direct Ad"} · Scope: ${projectType} (${workstationCount ? workstationCount + " seats" : "General"})`,
      channel: leadSource.includes("google") ? "GOOGLE_ADS" : "META_ADS",
      metadata: { campaignName, utmSource, utmMedium, isDummyPhone },
      actor: "Ad Webhook",
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        isExisting: false,
        leadId,
        isDummyPhone,
        message: isDummyPhone
          ? "Lead captured with dummy phone flag in Ads section"
          : "New commercial ad lead captured successfully",
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
