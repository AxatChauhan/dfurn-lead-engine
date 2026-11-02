import { db } from "@/db";
import { candidates, erpSyncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ErpSyncPayload {
  candidateId: string;
  channel?: string;
}

export interface ErpSyncResult {
  success: boolean;
  enquiryCode?: string;
  clientCode?: string;
  message: string;
}

export async function pushCandidateToErp(candidateId: string): Promise<ErpSyncResult> {
  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();

  if (!candidate) {
    return { success: false, message: "Candidate not found" };
  }

  if (!candidate.phone) {
    return { success: false, message: "Candidate must have a valid phone number to sync with ERP" };
  }

  const erpBaseUrl = process.env.DFURN_ERP_URL || "http://localhost:3000";
  const intakeUrl = `${erpBaseUrl}/api/enquiries/intake`;

  // Parse contact person or decision makers if available
  let decisionMakerName = candidate.contactPerson || "";
  if (!decisionMakerName && candidate.decisionMakers) {
    try {
      const dm = JSON.parse(candidate.decisionMakers);
      if (Array.isArray(dm) && dm.length > 0) {
        decisionMakerName = dm[0].name;
      }
    } catch {}
  }

  const briefParts: string[] = [];
  if (candidate.leadSource?.startsWith("paid_ads")) {
    briefParts.push(`Paid Ad Lead (${candidate.campaignName || "Ad Campaign"}) in ${candidate.city || "India"}`);
  } else {
    briefParts.push(`Source: ${candidate.category || "Commercial Office"} in ${candidate.city || "India"}`);
  }

  if (candidate.projectType) briefParts.push(`Scope: ${candidate.projectType}`);
  if (candidate.workstationCount) briefParts.push(`Scale: ${candidate.workstationCount} Workstations`);
  if (candidate.hasFloorPlan) briefParts.push("Floor Plan: Verified/Available");
  if (candidate.projectTimeline) briefParts.push(`Timeline: ${candidate.projectTimeline}`);
  if (decisionMakerName) briefParts.push(`Contact: ${decisionMakerName}`);
  if (candidate.operatorNotes) {
    briefParts.push(`Notes: ${candidate.operatorNotes}`);
  } else if (candidate.reasoning) {
    briefParts.push(`Notes: ${candidate.reasoning}`);
  }

  const isPaidAd = candidate.leadSource?.startsWith("paid_ads");
  const channel = isPaidAd ? "Paid Ads" : "Lead Engine";
  const sourceCategory = isPaidAd
    ? "Social Media"
    : candidate.category === "Architect"
    ? "Architect/Designer"
    : "Direct";

  const payload = {
    channel,
    externalId: candidate.id,
    clientName: candidate.businessName,
    clientPhone: candidate.phone,
    clientEmail: candidate.email || undefined,
    clientCountry: "IN",
    sourceCategory,
    sourceName: candidate.campaignName || candidate.utmCampaign || undefined,
    brief: briefParts.join(" · "),
    payload: {
      category: candidate.category,
      city: candidate.city,
      leadSource: candidate.leadSource,
      campaignName: candidate.campaignName,
      projectType: candidate.projectType,
      workstationCount: candidate.workstationCount,
      hasFloorPlan: candidate.hasFloorPlan,
      qualificationStage: candidate.qualificationStage,
      operatorNotes: candidate.operatorNotes,
      leadTier: candidate.leadTier,
      totalScore: candidate.totalScore,
    },
  };

  try {
    const res = await fetch(intakeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error || "Failed to intake lead into D'furn ERP";
      logSync(candidate.id, null, null, payload, data, "FAILED", errMsg);
      return { success: false, message: errMsg };
    }

    const enquiryCode = data.enquiry?.code || data.enquiry?.enquiryNumber || "DF_ENQ";
    const clientCode = data.client?.clientCode || null;

    // Update candidate in local DB
    db.update(candidates)
      .set({
        status: "SYNCED_TO_ERP",
        qualificationStage: "CONVERTED",
        syncedToErpAt: new Date(),
        erpEnquiryCode: enquiryCode,
        erpClientCode: clientCode,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId))
      .run();

    logSync(candidate.id, enquiryCode, clientCode, payload, data, "SUCCESS");

    return {
      success: true,
      enquiryCode,
      clientCode,
      message: `Successfully pushed to ERP! Enquiry Code: ${enquiryCode}`,
    };
  } catch (error: any) {
    const errMsg = error.message || "Network error connecting to local D'furn ERP";
    logSync(candidate.id, null, null, payload, {}, "FAILED", errMsg);
    return { success: false, message: errMsg };
  }
}

function logSync(
  candidateId: string,
  erpEnquiryCode: string | null,
  erpClientCode: string | null,
  payload: any,
  response: any,
  status: "SUCCESS" | "FAILED",
  errorMessage?: string
) {
  try {
    db.insert(erpSyncLogs)
      .values({
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        candidateId,
        erpEnquiryCode: erpEnquiryCode || undefined,
        erpClientCode: erpClientCode || undefined,
        payload: JSON.stringify(payload),
        response: JSON.stringify(response),
        status,
        errorMessage: errorMessage || null,
        syncedAt: new Date(),
      })
      .run();
  } catch (err) {
    console.error("[ERP Sync Logger] Error:", err);
  }
}
