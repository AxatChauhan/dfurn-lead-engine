// RFC 4180 Compliant CSV Parser & Multi-Platform Ad Header Normalizer

export interface ParsedCsvLead {
  businessName: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  city: string;
  state?: string;
  leadSource: string;
  campaignName?: string;
  adName?: string;
  projectType: string;
  workstationCount?: number;
  notes?: string;
  rawRow: Record<string, string>;
}

export function parseCsv(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ""); // Remove UTF-8 BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
  }

  return rows;
}

function cleanHeaderKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseLeadCsv(csvText: string, fallbackSource: string = "paid_ads_meta"): {
  leads: ParsedCsvLead[];
  errors: string[];
} {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { leads: [], errors: ["CSV file must contain a header row and at least one data row."] };
  }

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(cleanHeaderKey);

  // Helper to find column index matching any of the candidate keywords
  const findColIndex = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = normalizedHeaders.findIndex((h) => h.includes(c) || c.includes(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const businessIdx = findColIndex("companyname", "businessname", "company", "firm", "studio", "business", "clientname");
  const contactIdx = findColIndex("fullname", "contactperson", "contactname", "leadname", "name", "client");
  const phoneIdx = findColIndex("phonenumber", "phone", "mobile", "contactnumber", "cell", "whatsapp", "usercolumnphone");
  const emailIdx = findColIndex("emailaddress", "email", "contactemail", "usercolumnemail");
  const cityIdx = findColIndex("city", "location", "town", "metro");
  const stateIdx = findColIndex("state", "province", "region");
  const campaignIdx = findColIndex("campaignname", "campaign", "adcampaign", "campaignid");
  const adIdx = findColIndex("adname", "ad", "creative", "creativeid");
  const workstationIdx = findColIndex("workstationcount", "workstations", "seats", "seatsneeded", "numberofworkstations", "capacity");
  const projectTypeIdx = findColIndex("projecttype", "scope", "requirement", "projectscope", "typeofproject");
  const notesIdx = findColIndex("notes", "comments", "details", "requirementdetails", "message", "inquiry");

  const leads: ParsedCsvLead[] = [];
  const errors: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((c) => c === "")) continue;

    const rawRow: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      rawRow[h] = row[i] || "";
    });

    const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : "";
    if (!rawPhone || rawPhone.trim() === "") {
      errors.push(`Row ${r + 1}: Skipped (Missing phone number).`);
      continue;
    }

    const businessName = businessIdx !== -1 ? row[businessIdx] : "";
    const contactPerson = contactIdx !== -1 ? row[contactIdx] : "";
    const email = emailIdx !== -1 ? row[emailIdx] : "";
    const city = cityIdx !== -1 && row[cityIdx] ? row[cityIdx] : "Ahmedabad";
    const state = stateIdx !== -1 ? row[stateIdx] : "Gujarat";
    const campaignName = campaignIdx !== -1 ? row[campaignIdx] : undefined;
    const adName = adIdx !== -1 ? row[adIdx] : undefined;
    const projectType = projectTypeIdx !== -1 && row[projectTypeIdx] ? row[projectTypeIdx] : "Modular Workstations";
    const rawSeats = workstationIdx !== -1 ? row[workstationIdx] : "";
    const parsedSeats = rawSeats ? parseInt(rawSeats.replace(/\D/g, ""), 10) : undefined;
    const workstationCount = !isNaN(parsedSeats as number) ? parsedSeats : undefined;
    const notes = notesIdx !== -1 ? row[notesIdx] : undefined;

    // Resolve displayed business name
    const finalBusinessName = (businessName || contactPerson || `Lead from ${city}`).trim();

    leads.push({
      businessName: finalBusinessName,
      contactPerson: contactPerson.trim() || undefined,
      phone: rawPhone.trim(),
      email: email.trim().toLowerCase() || undefined,
      city: city.trim(),
      state: state.trim(),
      leadSource: fallbackSource,
      campaignName: campaignName?.trim(),
      adName: adName?.trim(),
      projectType: projectType.trim(),
      workstationCount,
      notes: notes?.trim(),
      rawRow,
    });
  }

  return { leads, errors };
}
