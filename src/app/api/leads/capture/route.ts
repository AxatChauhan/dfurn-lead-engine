import { NextRequest, NextResponse } from "next/server";
import { ingestCandidateLead } from "@/lib/intake-pipeline";

/**
 * Inbound Lead Capture API (Meta Ads, Google Search Ads, Direct Forms)
 * Routes all incoming submissions strictly through the Universal Intake Gatekeeper.
 * Strictly zero em dashes.
 */
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

    // Pass through Universal Production Intake Gatekeeper
    const result = await ingestCandidateLead(
      {
        businessName: displayName,
        contactPerson: contactPerson || undefined,
        phone: rawPhone,
        email,
        city,
        state,
        category,
        projectType,
        workstationCount,
        projectTimeline,
        hasFloorPlan,
        estimatedBudget,
        leadSource,
        campaignName,
        utmSource,
        utmMedium,
        utmCampaign,
        notes: notes || `Direct commercial ad inquiry for ${projectType} in ${city}`,
        sourceType: "paid_ads",
      },
      {
        channel: "ad_webhook",
        actor: leadSource.includes("google") ? "Google Ads Webhook" : "Meta Ads Webhook",
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: true,
          rejected: true,
          rejectId: result.rejectedId,
          rejectionReason: result.rejectionReason,
          message: `Submission disqualified: ${result.details}`,
        },
        { status: 200 }
      );
    }

    if (result.action === "MERGED") {
      return NextResponse.json({
        success: true,
        isExisting: true,
        leadId: result.candidateId,
        message: `Existing lead updated with new inquiry details. Profile merged automatically without duplicate row creation.`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        isExisting: false,
        leadId: result.candidateId,
        message: "New commercial ad lead captured successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Leads Capture API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error processing lead capture", details: error?.message },
      { status: 500 }
    );
  }
}
