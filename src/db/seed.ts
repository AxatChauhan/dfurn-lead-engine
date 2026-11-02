import { candidates, outreachMessages, searches } from "./schema";
import { evaluateModularLeadScore } from "../lib/evaluator";
import { generateModularOutreach } from "../lib/copywriting";
import { eq } from "drizzle-orm";

export function seedDemoData(activeDb: any) {
  if (!activeDb) return;
  const existing = activeDb.select().from(candidates).all();

  // Update existing leads with qualification stages if empty
  for (const c of existing) {
    if (!c.qualificationStage) {
      activeDb.update(candidates)
        .set({
          qualificationStage: c.status === "SYNCED_TO_ERP" ? "CONVERTED" : "NEW",
          leadSource: c.sourceType === "google_maps" ? "google_maps" : "paid_ads_meta",
          category: c.category || "Commercial Office",
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, c.id))
        .run();
    }
  }

  const now = Date.now();
  const paidAdLeads = [
    {
      id: "lead_ad_meta_01",
      businessName: "Synergy Tech Spaces LLP",
      contactPerson: "Karan Singhal",
      category: "Commercial Office",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "Sindhu Bhavan Extension, Ahmedabad",
      phone: "+91 98250 88990",
      email: "karan@synergytechspaces.com",
      leadSource: "paid_ads_meta",
      campaignName: "Meta_Ahd_OfficeFitout_Q4",
      adsetName: "Commercial_RealEstate_35-55",
      adName: "Modular_Workstations_14Day_Video",
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "ahd_office_fitout",
      projectType: "Modular Workstations (60 Seats)",
      workstationCount: 60,
      projectTimeline: "Immediate (<15 days)",
      hasFloorPlan: true,
      estimatedBudget: "₹18,00,000 - ₹24,00,000",
      qualificationStage: "NEW",
      operatorNotes: "Inquired via Meta Instant Form for 60 linear workstations with acoustic screen partitions. Has CAD layout ready.",
      whatsappAvailable: true,
      hasCommercialFocus: true,
      rating: 4.7,
      reviewCount: 19,
      totalScore: 92,
      leadTier: "A+",
      status: "NEW",
      createdAt: new Date(now - 12 * 60 * 1000), // 12 mins ago
      updatedAt: new Date(now - 12 * 60 * 1000),
    },
    {
      id: "lead_ad_google_02",
      businessName: "Titanium Corporate Infra Projects",
      contactPerson: "Devendra Patel",
      category: "Fitout Contractor",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "Prahlad Nagar Corporate Road, Ahmedabad",
      phone: "+91 98980 33445",
      email: "devendra@titaniuminfra.in",
      leadSource: "paid_ads_google",
      campaignName: "Google_Search_OEM_Manufacturer_Gujarat",
      adsetName: "Modular_Furniture_B2B_Exact",
      adName: "Factory_Direct_OEM_Supply",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "oem_manufacturer_search",
      projectType: "Turnkey Fitout (120 Workstations + 6 Cabins)",
      workstationCount: 120,
      projectTimeline: "1-2 months",
      hasFloorPlan: true,
      estimatedBudget: "₹45,00,000 - ₹55,00,000",
      qualificationStage: "QUALIFIED",
      operatorNotes: "Verified via phone call. Contractor handling 2 floors in GIFT City. Wants 48h BOM costing. Ready for D'furn ERP enquiry intake.",
      whatsappAvailable: true,
      hasCommercialFocus: true,
      rating: 4.8,
      reviewCount: 31,
      totalScore: 96,
      leadTier: "A+",
      status: "QUALIFIED",
      createdAt: new Date(now - 2 * 3600 * 1000), // 2 hours ago
      updatedAt: new Date(now - 1 * 3600 * 1000),
    },
    {
      id: "lead_ad_meta_03",
      businessName: "Nexis Coworking Hub",
      contactPerson: "Sunita Rao",
      category: "Coworking Space",
      city: "Pune",
      state: "Maharashtra",
      address: "Baner Commercial High Street, Pune",
      phone: "+91 99220 55667",
      email: "sunita@nexiscowork.in",
      leadSource: "paid_ads_meta",
      campaignName: "Meta_Pune_CommercialWorkspaces",
      adsetName: "Coworking_Founders_Pune",
      adName: "Acoustic_Pods_Desks_Carousel",
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "pune_commercial_workspaces",
      projectType: "Workstations & Acoustic Pods",
      workstationCount: 45,
      projectTimeline: "1-2 months",
      hasFloorPlan: false,
      estimatedBudget: "₹12,00,000 - ₹16,00,000",
      qualificationStage: "CONTACTED",
      operatorNotes: "WhatsApp lookbook sent. Client reviewing 120-degree cluster workstation options. Callback scheduled for Thursday.",
      whatsappAvailable: true,
      hasCommercialFocus: true,
      rating: 4.5,
      reviewCount: 12,
      totalScore: 82,
      leadTier: "A",
      status: "CONTACTED",
      createdAt: new Date(now - 5 * 3600 * 1000), // 5 hours ago
      updatedAt: new Date(now - 3 * 3600 * 1000),
    },
    {
      id: "lead_ad_web_04",
      businessName: "Urban Haven Residences",
      contactPerson: "Chirag Shah",
      category: "Residential",
      city: "Surat",
      state: "Gujarat",
      address: "Vesu Canal Road, Surat",
      phone: "+91 98240 11998",
      email: "chirag.shah@gmail.com",
      leadSource: "website_form",
      campaignName: "Website_Contact_Form",
      utmSource: "direct_organic",
      utmMedium: "form",
      utmCampaign: "landing_page",
      projectType: "Single Bedroom Modular Wardrobe",
      workstationCount: 0,
      projectTimeline: "Planning",
      hasFloorPlan: false,
      estimatedBudget: "₹75,000",
      qualificationStage: "LOST",
      operatorNotes: "B2C retail single piece inquiry. Politely informed that D'furn specializes in commercial B2B projects and MOQ is 10 units.",
      whatsappAvailable: true,
      hasCommercialFocus: false,
      rating: 0,
      reviewCount: 0,
      totalScore: 35,
      leadTier: "D",
      status: "REJECTED",
      createdAt: new Date(now - 24 * 3600 * 1000), // 1 day ago
      updatedAt: new Date(now - 20 * 3600 * 1000),
    }
  ];

  for (const adLead of paidAdLeads) {
    const existingLead = activeDb.select().from(candidates).where(eq(candidates.id, adLead.id)).get();
    if (!existingLead) {
      activeDb.insert(candidates).values(adLead).run();
    }
  }

  if (existing.length === 0) {

  const searchId = "seed_ahmedabad_architects";
  activeDb.insert(searches)
    .values({
      id: searchId,
      industry: "Architects & Interior Designers",
      location: "Ahmedabad",
      targetCount: 5,
      status: "completed",
      candidatesFound: 5,
      qualifiedCount: 4,
      startedAt: new Date(),
      completedAt: new Date(),
    })
    .run();

  const seedProspects = [
    {
      id: "prospect_mod_01",
      businessName: "Studio Morphogenesis Architects",
      category: "Architect",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "Sindhu Bhavan Road, Bodakdev, Ahmedabad",
      phone: "+91 98250 12345",
      email: "contact@morphogenesis-ahd.in",
      website: "https://morphogenesis.org",
      rating: 4.8,
      reviewCount: 42,
      hasCommercialFocus: true,
      whatsappAvailable: true,
      decisionMakers: [
        { name: "Ar. Harsh Patel", title: "Principal Architect" },
        { name: "Pooja Shah", title: "Design Partner" },
      ],
      portfolioTags: ["Commercial Office", "Modular Workstations", "Turnkey Fitout"],
    },
    {
      id: "prospect_mod_02",
      businessName: "Apex Turnkey Commercial Fitouts",
      category: "Fitout Contractor",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "Prahlad Nagar Corporate Road, Ahmedabad",
      phone: "+91 98980 54321",
      email: "projects@apexfitouts.com",
      website: "https://apexfitouts.com",
      rating: 4.6,
      reviewCount: 28,
      hasCommercialFocus: true,
      whatsappAvailable: true,
      decisionMakers: [
        { name: "Vikram Desai", title: "Managing Director" },
        { name: "Sanjay Mehta", title: "Head of Procurement" },
      ],
      portfolioTags: ["Turnkey Fitout", "Corporate Office", "Modular Workstations"],
    },
    {
      id: "prospect_mod_03",
      businessName: "Atelier Linea Interior Design Studio",
      category: "Interior Designer",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "Ambli-Bopal Road, Ahmedabad",
      phone: "+91 97270 98765",
      email: "studio@atelierlinea.com",
      website: "https://atelierlinea.com",
      rating: 4.9,
      reviewCount: 35,
      hasCommercialFocus: true,
      whatsappAvailable: true,
      decisionMakers: [
        { name: "Neha Trivedi", title: "Creative Director" },
      ],
      portfolioTags: ["Commercial Office", "Luxury Residential"],
    },
    {
      id: "prospect_mod_04",
      businessName: "Zenith Coworking Hubs & Workspaces",
      category: "Coworking Space",
      city: "Pune",
      state: "Maharashtra",
      address: "Kharadi IT Park, Pune",
      phone: "+91 99220 11223",
      email: "facilities@zenithworkspaces.in",
      website: "https://zenithworkspaces.in",
      rating: 4.5,
      reviewCount: 64,
      hasCommercialFocus: true,
      whatsappAvailable: true,
      decisionMakers: [
        { name: "Rohan Kulkarni", title: "Facilities & Infrastructure Head" },
      ],
      portfolioTags: ["Modular Workstations", "Commercial Office"],
    },
    {
      id: "prospect_mod_05",
      businessName: "Aakar Residential Design Collective",
      category: "Interior Designer",
      city: "Surat",
      state: "Gujarat",
      address: "Ghod Dod Road, Surat",
      phone: "+91 98241 67890",
      email: "hello@aakarcollective.in",
      website: "https://aakarcollective.in",
      rating: 4.2,
      reviewCount: 14,
      hasCommercialFocus: false,
      whatsappAvailable: true,
      decisionMakers: [
        { name: "Bhavin Choksi", title: "Lead Designer" },
      ],
      portfolioTags: ["Luxury Residential"],
    },
  ];

  for (const item of seedProspects) {
    const scoring = evaluateModularLeadScore({
      businessName: item.businessName,
      category: item.category,
      city: item.city,
      phone: item.phone,
      email: item.email,
      website: item.website,
      rating: item.rating,
      reviewCount: item.reviewCount,
      hasCommercialFocus: item.hasCommercialFocus,
      whatsappAvailable: item.whatsappAvailable,
      portfolioTags: item.portfolioTags,
      decisionMakersCount: item.decisionMakers.length,
    });

    activeDb.insert(candidates)
      .values({
        id: item.id,
        searchId,
        businessName: item.businessName,
        industry: item.category,
        category: item.category,
        city: item.city,
        state: item.state,
        address: item.address,
        phone: item.phone,
        email: item.email,
        website: item.website,
        rating: item.rating,
        reviewCount: item.reviewCount,
        sourceType: "google_maps",
        totalScore: scoring.totalScore,
        leadTier: scoring.leadTier,
        fitScore: scoring.fitScore,
        scaleScore: scoring.scaleScore,
        activityScore: scoring.activityScore,
        accessibilityScore: scoring.accessibilityScore,
        synergyScore: scoring.synergyScore,
        reasoning: scoring.reasoning,
        decisionMakers: JSON.stringify(item.decisionMakers),
        portfolioTags: JSON.stringify(item.portfolioTags),
        hasCommercialFocus: item.hasCommercialFocus,
        whatsappAvailable: item.whatsappAvailable,
        status: "NEW",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const copy = generateModularOutreach({
      businessName: item.businessName,
      category: item.category,
      city: item.city,
      contactName: item.decisionMakers[0]?.name,
      phone: item.phone,
      portfolioTags: item.portfolioTags,
      recommendedHook: scoring.recommendedHook,
    });

    activeDb.insert(outreachMessages)
      .values({
        id: `seed_msg_wa_${item.id}`,
        candidateId: item.id,
        channel: "WHATSAPP",
        stepNumber: 1,
        subject: "Architect Swatch Box Offer",
        bodyContent: copy.whatsAppMessage,
        evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
        approvalStatus: "draft_pending_review",
        createdAt: new Date(),
      })
      .run();

    activeDb.insert(outreachMessages)
      .values({
        id: `seed_msg_em_${item.id}`,
        candidateId: item.id,
        channel: "EMAIL",
        stepNumber: 1,
        subject: copy.coldEmail.subject,
        bodyContent: copy.coldEmail.body,
        evidenceAnchors: JSON.stringify(copy.evidenceAnchors),
        approvalStatus: "draft_pending_review",
        createdAt: new Date(),
      })
      .run();
  }

  console.log("Successfully seeded 5 initial prospects across Architects, Fitout Contractors & Coworking.");
  }
}
