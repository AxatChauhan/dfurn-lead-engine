export interface OutreachTemplate {
  id: string;
  name: string;
  badge: string;
  channel: "WHATSAPP" | "EMAIL";
  subject?: string;
  bodyTemplate: string;
}

/**
 * 100% Online Specifier Outreach Templates
 * Strictly zero em dashes · Strictly zero physical mailer/sample references.
 */
export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "CAD_BIM_LIBRARY",
    name: "CAD & BIM Workstation Library Drop",
    badge: "CAD Library",
    channel: "WHATSAPP",
    bodyTemplate:
      "Hi {{name}}, admiring {{company}}'s commercial fitout work in {{city}}. We operate a 48,000 sq ft contract modular furniture manufacturing plant in Kheda and have published our complete 2026 Commercial Workstation CAD/BIM block library (.DWG & .RFA):\n\nhttps://dfurn.in/specifiers/cad-library\n\nIncludes linear pods, 120-degree clusters, and wire raceway detailing. Would you like direct access for your drafting team?",
  },
  {
    id: "BOQ_24H_TURNAROUND",
    name: "24-Hour Factory BOQ Turnaround",
    badge: "24h BOQ",
    channel: "WHATSAPP",
    bodyTemplate:
      "Hi {{name}}, quick question: is {{company}} working on any active commercial office floor plans in {{city}} this month? If you share a rough PDF/DWG layout, our drafting engineers will return a complete, itemized factory BOQ with 3D elevations within 24 hours - zero cost, no obligation.\n\nUpload active layouts here: https://dfurn.in/specifiers/cad-library#upload",
  },
  {
    id: "PBR_TEXTURE_PACK",
    name: "Seamless 4K PBR Texture Pack",
    badge: "3D Renders",
    channel: "WHATSAPP",
    bodyTemplate:
      "Hi {{name}}, sharing our 2026 high-resolution PBR texture pack (Merino laminates + RAL powder-coating colors) for {{company}}'s 3D visualizers (V-Ray / Enscape). Speeds up photorealistic client pitch renders.\n\nDirect download link: https://dfurn.in/specifiers/cad-library#textures",
  },
  {
    id: "FACTORY_TOUR_VIRTUAL",
    name: "4K Virtual Plant Tour Showcase",
    badge: "Plant Video",
    channel: "WHATSAPP",
    bodyTemplate:
      "Hi {{name}}, wanted to share a 90-second 4K video walkthrough of our 48,000 sq ft Kheda modular furniture plant (German Homag edgebanders, CNC beam saws, 750T press brake): https://dfurn.in/factory-tour .\n\nWe provide direct-from-plant contract pricing with 14-day dispatch to keep your projects on schedule.",
  },
  {
    id: "COLD_EMAIL_SPEC",
    name: "Commercial Specification Proposal",
    badge: "Email",
    channel: "EMAIL",
    subject: "AutoCAD & Revit blocks for {{company}}'s commercial layouts · D'furn",
    bodyTemplate:
      "Dear Ar. {{name}},\n\nI recently reviewed {{company}}'s portfolio in {{city}}. The detailing on your open-plan commercial collaboration zones is exceptional.\n\nI lead commercial projects at D'furn Modular Systems. We operate a 48,000 sq. ft. contract modular furniture plant in Kheda, engineered specifically for enterprise office fit-outs (German Homag edgebanding, CNC panel processing, and 750T mild steel press brake forming).\n\nTo support commercial architects during the concept and layout phase, we have compiled our complete 2026 modular workstation catalogue into ready-to-drop 2D AutoCAD (.dwg) blocks and 3D Revit (.rfa) families:\n\nDirect download link: https://dfurn.in/specifiers/cad-library\n\nKey assets included:\n1. Linear benching clusters (L 1200 x B 600 mm) with spine raceway wire management\n2. 120-degree collaborative desking with acoustic PET screen specifications\n3. 4K seamless PBR texture swatches (laminate & powder-coat finishes) for photorealistic V-Ray / Enscape client renders\n\nIf {{company}} has an active floor plan in development, feel free to reply with a PDF or DWG layout. Our team will return a line-item factory BOQ with 3D elevations within 24 hours - zero cost, no obligation.\n\nWarm regards,\nDfurn Modular Systems Pvt. Ltd.\nCorporate Office: Bodakdev, Ahmedabad · Plant: Kheda, Gujarat\nContact: +91 98250 88990 · https://dfurn.in",
  },
];

export function renderTemplate(templateId: string, lead: any): { message: string; subject?: string } {
  const tpl = OUTREACH_TEMPLATES.find((t) => t.id === templateId) || OUTREACH_TEMPLATES[0];

  const name = lead.contactPerson || lead.businessName || "there";
  const company = lead.businessName || "your firm";
  const city = lead.city || "your city";
  const project = lead.projectType || "modular furniture";
  const scale = lead.workstationCount ? ` (${lead.workstationCount} workstations)` : "";

  let renderedBody = tpl.bodyTemplate
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{company\}\}/g, company)
    .replace(/\{\{city\}\}/g, city)
    .replace(/\{\{project\}\}/g, project)
    .replace(/\{\{scale\}\}/g, scale);

  let renderedSubject = tpl.subject
    ? tpl.subject
        .replace(/\{\{name\}\}/g, name)
        .replace(/\{\{company\}\}/g, company)
        .replace(/\{\{city\}\}/g, city)
    : undefined;

  return { message: renderedBody, subject: renderedSubject };
}
