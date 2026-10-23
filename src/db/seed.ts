import { db } from "./index";
import { candidates, outreachMessages, searches } from "./schema";
import { evaluateModularLeadScore } from "../lib/evaluator";
import { generateModularOutreach } from "../lib/copywriting";

export function seedDemoData() {
  const existing = db.select().from(candidates).all();
  if (existing.length > 0) {
    console.log("Database already contains leads. Skipping seed.");
    return;
  }

  console.log("Seeding verified Modular Furniture B2B & B2B2C leads...");

  const searchId = "seed_ahmedabad_architects";
  db.insert(searches)
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

    db.insert(candidates)
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

    db.insert(outreachMessages)
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

    db.insert(outreachMessages)
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
