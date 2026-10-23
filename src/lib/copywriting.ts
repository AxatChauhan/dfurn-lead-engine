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

If you have an active floor plan or upcoming corporate fitout, we can turnaround a comprehensive CAD and BOM costing within 48 hours to help you optimize your project margin.

Would you be open to a 5-minute introductory call this week?

Warm regards,
D'furn Modular Systems
Manufacturing Facility & Design Studio
Contact: +91 98765 43210 · dfurn.com`;
  } else {
    // Architect / Interior Designer
    whatsAppMessage = `Hi ${name}, love the refined interior aesthetics ${firm} delivers in ${city}. I am from D'furn Modular Systems. We partner with architects to manufacture precision modular furniture, custom workstations, and prelam cabinetry directly from our factory. We would love to send a complimentary Architect Material & Finish Swatch Box (Laminates, Edge Bands & Powder Coated Profiles) to your studio desk. Would this week work for a quick drop-off?`;

    emailSubject = `Architect Finish Swatch Box for ${firm} · D'furn Modular Systems`;
    emailBody = `Dear ${name},

We have been admiring the refined architectural work that ${firm} has completed in ${city}.

As an architectural studio, delivering flawless edge-banding and precision factory finishes without relying on erratic on-site carpenters is essential for client delight. D'furn Modular Systems partners directly with architects as an OEM specification partner:

1. Bespoke Specification Support: 48-hour 3D CAD modeling and detailed BOM costing for your client presentations.
2. Complete Catalog Swatches: Over 120 standard laminates, acoustic felt finishes, and architectural powder-coated aluminum extrusions.
3. Factory Precision: Zero manual trimming, seamless PUR edge-banding, and modular assembly.

We would like to courier our complimentary Architect Swatch Kit directly to your studio desk so you have physical samples on hand for your next client discussion.

Could you confirm the best studio address for delivery?

Warm regards,
D'furn Modular Systems
Factory & Studio Experience Centre
Direct: +91 98765 43210 · dfurn.com`;
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
    hook: isContractor
      ? `We supply factory-finished modular workstations and executive desks to commercial fitout contractors to eliminate on-site carpentry delays. I noticed your recent commercial projects and wanted to see how you currently handle modular furniture fabrication.`
      : `We are an OEM factory manufacturing modular office furniture and cabinetry for architects. We are sending out our new 2026 Material Swatch Boxes to select design studios in ${city} and wanted to confirm where to dispatch your kit.`,
    objectionCarpenter: `I completely understand you have carpenters on site. Most of our contractor partners do too for civil work, but they use our factory for workstations and prelam panels because our machines produce 100 desks in 3 days with laser-straight edges that on-site hand routers simply cannot match.`,
    objectionCatalog: `I will send our digital catalog right now to this WhatsApp number. Take 30 seconds to look at the workstation profiles, and if you have an active floor plan, we will price it out within 24 hours.`,
    close: `May I confirm the best email and WhatsApp number to send the specifications right over?`,
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
