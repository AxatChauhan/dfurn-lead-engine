export interface CopywritingInput {
  businessName: string;
  category?: string | null;
  city?: string | null;
  contactName?: string | null;
  phone?: string | null;
  portfolioTags?: string[] | null;
  recommendedHook?: string | null;
}

export interface CopywritingOutput {
  whatsAppMessage: string;
  whatsAppLink: string;
  coldEmail: {
    subject: string;
    body: string;
  };
  coldCallScript: {
    opener: string;
    hook: string;
    objectionCarpenter: string;
    objectionCatalog: string;
    close: string;
  };
  evidenceAnchors: string[];
}

/**
 * Generates 100% Online Specifier Copywriting
 * Strictly zero em dashes · Strictly zero physical mailer references.
 */
export function generateModularOutreach(input: CopywritingInput): CopywritingOutput {
  const firm = input.businessName;
  const name = input.contactName || "Team";
  const city = input.city || "your city";
  const isContractor = (input.category || "").toLowerCase().includes("contractor") || (input.category || "").toLowerCase().includes("fitout");

  const evidenceAnchors: string[] = [];
  if (input.portfolioTags && input.portfolioTags.length > 0) {
    evidenceAnchors.push(`Portfolio: ${input.portfolioTags.join(", ")}`);
  }
  evidenceAnchors.push(`Location: ${city}`);

  let whatsAppMessage = "";
  let emailSubject = "";
  let emailBody = "";

  if (isContractor) {
    whatsAppMessage = `Hi ${name}, saw your turnkey commercial work in ${city}. Reaching out from D'furn Modular Systems. We provide precision factory OEM modular manufacturing (workstations, executive desks, acoustic panels) for commercial fitout contractors facing tight deadlines. With automated German panel sizing and 14-day dispatch, we de-risk your site delivery penalties. Can I send over our 2026 contractor price catalog on WhatsApp?`;

    emailSubject = `Factory OEM Workstation Supply for ${firm} · D'furn`;
    emailBody = `Dear ${name},

I am writing from D'furn Modular Systems. We noticed the scale of turnkey interior fitout projects ${firm} executes across ${city}.

Commercial contractors often struggle with on-site carpentry delays, edge-banding imperfections, and escalating labor costs. D'furn solves this through precision factory manufacturing:

1. 14-Day Factory Dispatch: High-speed production using automated beam saws and throughfeed edge-banders.
2. 282 Master Product Configurations: Linear workstations, 120-degree clusters, executive cabins, and acoustic pods.
3. 18% GST Compliant B2B Billing: Direct OEM wholesale rates with complete tax input credit.

If you have an active floor plan or upcoming corporate fitout, we can turnaround a comprehensive CAD and BOM costing within 24 hours to help you optimize your project margin.

Would you be open to a 5-minute introductory call this week?

Warm regards,
D'furn Modular Systems
Manufacturing Facility: Kheda · Corporate Office: Bodakdev, Ahmedabad
Contact: +91 98250 88990 · https://dfurn.in`;
  } else {
    // Commercial Architect / Interior Designer (100% Online CAD & BOQ Hook)
    whatsAppMessage = `Hi ${name}, admired ${firm}'s workplace design projects in ${city}. Reaching out from D'furn Modular Systems. We operate a 48,000 sq ft contract modular furniture plant in Kheda and have published our complete 2026 Commercial Workstation CAD/BIM block library (.DWG & .RFA): https://dfurn.in/specifiers/cad-library . We also offer a free 24-hour factory BOQ turnaround for active layouts. Would you like direct access for your drafting team?`;

    emailSubject = `AutoCAD & Revit blocks for ${firm}'s commercial layouts · D'furn Modular Systems`;
    emailBody = `Dear ${name},

We have been admiring the refined architectural work that ${firm} has completed in ${city}.

As an architectural studio, delivering flawless modular workstations and precision factory finishes without relying on erratic on-site carpenters is essential for corporate client delight. D'furn Modular Systems partners directly with commercial architects as an OEM specification partner:

1. Ready-to-Drop CAD & BIM Blocks: Native 2D AutoCAD (.dwg) and 3D Revit (.rfa) workstation families with integrated wire raceway specifications (https://dfurn.in/specifiers/cad-library).
2. 24-Hour Factory BOQ Costing: Send any active floor plan, and our engineering team returns an itemized component BOQ with 3D elevations within 24 hours - zero cost, no obligation.
3. German Homag Edge-Banding: Automated PUR edge-banding with zero manual trimming and direct-from-plant 14-day dispatch.

If you have an active corporate layout in development, feel free to reply with a PDF or DWG layout for rapid pricing.

Warm regards,
D'furn Modular Systems
Manufacturing Plant: Kheda · Corporate Office: Bodakdev, Ahmedabad
Direct: +91 98250 88990 · https://dfurn.in`;
  }

  // Format WhatsApp Link
  const phoneDigits = (input.phone || "").replace(/\D/g, "");
  let cleanPhone = phoneDigits;
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
  const whatsAppLink = cleanPhone.length >= 10
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`
    : "";

  const coldCallScript = {
    opener: `Good morning, am I speaking with ${name} at ${firm}? Hi, my name is Rahul from D'furn Modular Systems in ${city}.`,
    hook: `We noticed ${firm}'s commercial office projects and wanted to share our free AutoCAD and Revit BIM workstation library to save your drafting team time on active layouts.`,
    objectionCarpenter: `Understood. Most studios keep carpenters for civil gypsum, but specify our factory for modular desking because our German beam saws produce 100 workstations in 3 days with zero manual trimming errors.`,
    objectionCatalog: `I can send our instant 2D/3D CAD library link and 2026 lookbook directly over WhatsApp right now so your team has it on file.`,
    close: `Would it be helpful if I shared our 24-hour BOQ template on WhatsApp?`
  };

  return {
    whatsAppMessage,
    whatsAppLink,
    coldEmail: {
      subject: emailSubject,
      body: emailBody,
    },
    coldCallScript,
    evidenceAnchors,
  };
}
