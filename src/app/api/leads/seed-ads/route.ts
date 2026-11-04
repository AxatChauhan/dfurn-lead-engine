import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, candidateEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { channel } = await req.json().catch(() => ({ channel: "paid_ads_meta" }));
    const targetChannel = channel === "paid_ads_google" ? "paid_ads_google" : "paid_ads_meta";

    const sampleLeads = targetChannel === "paid_ads_meta"
      ? [
          {
            id: `meta_lead_${Date.now()}_1`,
            businessName: "Nexus Workplace Solutions",
            contactPerson: "Ar. Bhavin Shah",
            phone: "+91 98251 44550",
            email: "bhavin@nexusworkplace.in",
            city: "Ahmedabad",
            state: "Gujarat",
            category: "Commercial Office",
            projectType: "Modular Workstations",
            workstationCount: 65,
            hasFloorPlan: true,
            projectTimeline: "Immediate (30 days)",
            estimatedBudget: "INR 25 - 30 Lakhs",
            leadSource: "paid_ads_meta",
            sourceType: "paid_ads",
            campaignName: "META_INSTANT_FORM_OFFICE_FITOUT_Q4",
            adsetName: "AHMEDABAD_COMMERCIAL_ARCHITECTS_30_55",
            adName: "24H_FACTORY_BOQ_CAROUSEL_V2",
            utmSource: "facebook",
            utmMedium: "paid_social",
            utmCampaign: "meta_leads_gujarat",
            totalScore: 92,
            leadTier: "A+",
            qualificationStage: "NEW",
            operatorNotes: "Client requested 65 linear workstations with acoustic screen dividers and 24h factory BOQ estimate.",
            isDummyPhone: false,
            enrichmentStatus: "ENRICHED" as const,
          },
          {
            id: `meta_lead_${Date.now()}_2`,
            businessName: "Inspire Turnkey Interiors",
            contactPerson: "Kunal Parikh",
            phone: "+91 97129 88320",
            email: "kunal@inspireturnkey.com",
            city: "GIFT City",
            state: "Gujarat",
            category: "Turnkey Fitout Contractor",
            projectType: "Full Floor Modular Fitout",
            workstationCount: 120,
            hasFloorPlan: true,
            projectTimeline: "45-60 days",
            estimatedBudget: "INR 50 Lakhs+",
            leadSource: "paid_ads_meta",
            sourceType: "paid_ads",
            campaignName: "META_CLICK_TO_WHATSAPP_GIFT_CITY",
            adsetName: "GIFT_CITY_FINTECH_TOWERS",
            adName: "DIRECT_OEM_PLANT_PRICING",
            utmSource: "instagram",
            utmMedium: "paid_social",
            utmCampaign: "gift_city_expansion",
            totalScore: 96,
            leadTier: "A+",
            qualificationStage: "NEW",
            operatorNotes: "Fintech enterprise office floor fitout. Needs German Homag edgebanded desking with integrated wire raceway.",
            isDummyPhone: false,
            enrichmentStatus: "ENRICHED" as const,
          },
          {
            id: `meta_lead_${Date.now()}_3`,
            businessName: "Prime Space Consultants",
            contactPerson: "Test Lead User",
            phone: "+91 99999 99999",
            email: "primespace.test@gmail.com",
            city: "Ahmedabad",
            state: "Gujarat",
            category: "Commercial Office",
            projectType: "Modular Desking",
            workstationCount: 30,
            hasFloorPlan: false,
            projectTimeline: "Exploring",
            estimatedBudget: "INR 10 - 15 Lakhs",
            leadSource: "paid_ads_meta",
            sourceType: "paid_ads",
            campaignName: "META_INSTANT_FORM_OFFICE_FITOUT_Q4",
            adsetName: "BROAD_LOOKALIKE_COMMERCIAL",
            adName: "MODULAR_DESKING_SPEED_DISPATCH",
            utmSource: "facebook",
            utmMedium: "paid_social",
            utmCampaign: "meta_leads_gujarat",
            totalScore: 45,
            leadTier: "C",
            qualificationStage: "LOST",
            operatorNotes: "Suspected dummy phone submission (9999999999). Preserved in Dummy Submissions list for operator inspection.",
            isDummyPhone: true,
            enrichmentStatus: "FAILED" as const,
          },
        ]
      : [
          {
            id: `google_lead_${Date.now()}_1`,
            businessName: "Apex Global Technology Center",
            contactPerson: "Manish Trivedi (Facility VP)",
            phone: "+91 98980 22119",
            email: "manish.trivedi@apextechnologies.com",
            city: "Ahmedabad",
            state: "Gujarat",
            category: "Corporate Enterprise",
            projectType: "Contract Workstations & Pods",
            workstationCount: 180,
            hasFloorPlan: true,
            projectTimeline: "Urgent (20 days dispatch)",
            estimatedBudget: "INR 75 Lakhs",
            leadSource: "paid_ads_google",
            sourceType: "paid_ads",
            campaignName: "GOOGLE_SEARCH_OEM_WORKSTATIONS_GUJARAT",
            adsetName: "HIGH_INTENT_MANUFACTURER_KEYWORDS",
            adName: "DIRECT_FROM_PLANT_14_DAY_DISPATCH",
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "search_workstation_manufacturer",
            totalScore: 98,
            leadTier: "A+",
            qualificationStage: "NEW",
            operatorNotes: "Enterprise IT hub expanding floor in SG Highway. High commercial intent search query.",
            isDummyPhone: false,
            enrichmentStatus: "ENRICHED" as const,
          },
          {
            id: `google_lead_${Date.now()}_2`,
            businessName: "Zenith Design & Project Management",
            contactPerson: "Ritika Desai",
            phone: "+91 98240 55123",
            email: "ritika@zenithpmc.in",
            city: "Vadodara",
            state: "Gujarat",
            category: "PMC Project Management",
            projectType: "Executive Benching & Meeting Tables",
            workstationCount: 40,
            hasFloorPlan: true,
            projectTimeline: "1 month",
            estimatedBudget: "INR 18 - 22 Lakhs",
            leadSource: "paid_ads_google",
            sourceType: "paid_ads",
            campaignName: "GOOGLE_SEARCH_MODULAR_OFFICE_FURNITURE",
            adsetName: "PMC_COMMERCIAL_FURNITURE_SEARCH",
            adName: "FACTORY_BOQ_CAD_BLOCKS",
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "search_commercial_furniture",
            totalScore: 91,
            leadTier: "A",
            qualificationStage: "NEW",
            operatorNotes: "Consultant looking for OEM factory partnership for upcoming corporate project in Vadodara.",
            isDummyPhone: false,
            enrichmentStatus: "ENRICHED" as const,
          },
        ];

    let insertedCount = 0;
    for (const lead of sampleLeads) {
      const existing = await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(eq(candidates.businessName, lead.businessName))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(candidates).values(lead);
        await db.insert(candidateEvents).values({
          id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          candidateId: lead.id,
          eventType: "LEAD_CAPTURED",
          title: "Inbound Lead Captured",
          description: `Captured from campaign: ${lead.campaignName} (Ad: ${lead.adName})`,
          channel: targetChannel === "paid_ads_google" ? "GOOGLE_ADS" : "META_ADS",
          metadata: {
            campaignName: lead.campaignName,
            workstationCount: lead.workstationCount,
            adName: lead.adName,
            isDummyPhone: lead.isDummyPhone,
          },
          actor: "Ad Engine Webhook",
          createdAt: new Date(),
        });
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      channel: targetChannel,
      message: `Seeded ${insertedCount} realistic sample leads into ${targetChannel}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
