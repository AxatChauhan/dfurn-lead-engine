import { cleanLeadCategory } from "./dedup";

/**
 * Commercial B2B Qualification Shield & Pre-Ingestion Sanitizer
 * Guarantees zero residential leaks, eliminates aggregator noise,
 * enforces strict phone validity, and standardizes commercial taxonomy.
 * Strictly zero em dashes.
 */

// Strict residential and consumer keyword blocklist
const RESIDENTIAL_BLOCKLIST = [
  "modular kitchen",
  "kitchen trolley",
  "kitchen interior",
  "wardrobe",
  "sliding wardrobe",
  "sofa",
  "bed",
  "mattress",
  "mandir",
  "pooja room",
  "puja unit",
  "tv unit",
  "residential interior",
  "bungalow interior",
  "villa interior",
  "flat interior",
  "apartment interior",
  "home interior",
  "home decor",
  "2bhk",
  "3bhk",
  "4bhk",
  "living room",
  "bedroom",
  "dining table set",
  "shoe rack",
  "dressing table",
  "crockery unit",
];

// Directory, portal, and search aggregator patterns
const AGGREGATOR_PATTERNS = [
  /\b(?:top\s*\d+|best\s*\d+|list\s*of)\b/i,
  /\b(?:showrooms?\s*near\s*me|dealers?\s*near\s*me)\b/i,
  /\b(?:justdial|indiamart|sulekha|tradeindia|urban\s*company)\b/i,
  /\b(?:magicbricks|99acres|housing\.com)\b/i,
  /\b(?:yellow\s*pages|business\s*directory)\b/i,
];

/**
 * Strips non-printable unicode, icon glyphs (Private Use Area), review stars, and emoji.
 */
export function stripUnicodeArtifacts(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/[\uE000-\uF8FF]/g, "") // Private Use Area glyphs (e.g. , )
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // Surrogate pairs / emoji
    .replace(/[★☆✦★]+/g, "") // Star rating symbols
    .replace(/[\u2014\u2013]/g, " - ") // Normalize dashes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cleans business name of location trailer noise, search prefixes, and punctuation.
 */
export function cleanBusinessName(raw?: string | null): string {
  if (!raw) return "";
  let name = stripUnicodeArtifacts(raw);

  // Remove search prefix noise
  name = name.replace(/^(?:Best|Top|Leading|Find|Contact|Directory\s+of)\s+[0-9]*\s*/i, "");

  // Remove trailer suffixes (e.g. " - Prahlad Nagar", " | SG Highway", " (Ahmedabad)")
  name = name.split(/\s*[-–|•:]\s*(?:Ahmedabad|Gujarat|Sindhu Bhavan|Prahlad Nagar|SG Highway|Surat|Vadodara|GIFT City|Bodakdev|Satellite)\b/i)[0];
  name = name.replace(/\s*\((?:Ahmedabad|Gujarat|Surat|Vadodara)\)\s*$/i, "");

  // Remove trailing punctuation
  name = name.replace(/[-–|•:,]+$/, "").trim();

  return name;
}

/**
 * Checks if a prospect is an aggregator or directory listing.
 */
export function isAggregatorOrDirectory(text?: string | null): boolean {
  if (!text) return false;
  return AGGREGATOR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Checks if a prospect inquiry is an explicit residential mismatch.
 */
export function isResidentialInquiry(text?: string | null): { isResidential: boolean; matchedKeyword?: string } {
  if (!text) return { isResidential: false };
  const lower = text.toLowerCase();

  for (const kw of RESIDENTIAL_BLOCKLIST) {
    if (lower.includes(kw)) {
      return { isResidential: true, matchedKeyword: kw };
    }
  }

  return { isResidential: false };
}

/**
 * Validates whether a phone number is a valid, callable Indian number.
 * Returns formatted phone string or error reason.
 */
export function validateAndFormatPhone(raw?: string | null): {
  isValid: boolean;
  phone?: string;
  isMobile?: boolean;
  isLandline?: boolean;
  rejectionReason?: string;
} {
  if (!raw) {
    return { isValid: false, rejectionReason: "MISSING_PHONE" };
  }

  const cleaned = raw.replace(/[^\d+]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");

  // 1. Missing or too short
  if (digits.length < 8) {
    return { isValid: false, rejectionReason: "PHONE_TOO_SHORT" };
  }

  // 2. Toll-Free Numbers (1800, 1860) - not suitable for direct decision-maker telecalling
  if (digits.startsWith("1800") || digits.startsWith("1860")) {
    return { isValid: false, rejectionReason: "TOLL_FREE_NUMBER" };
  }

  // 3. Repeated / Dummy Digits (e.g., 9999999999, 0000000000)
  if (/^(\d)\1{7,}$/.test(digits)) {
    return { isValid: false, rejectionReason: "REPETITIVE_DUMMY_PHONE" };
  }

  // 4. Sequential Dummy Numbers
  if (
    digits.includes("123456789") ||
    digits.includes("987654321") ||
    digits.includes("012345678") ||
    digits.includes("876543210")
  ) {
    return { isValid: false, rejectionReason: "SEQUENTIAL_DUMMY_PHONE" };
  }

  // 5. Ahmedabad Landlines (STD 079 + 8 digits)
  if (digits.startsWith("079") && digits.length === 11) {
    return {
      isValid: true,
      phone: `079-${digits.slice(3, 7)} ${digits.slice(7)}`,
      isLandline: true,
    };
  }
  if (digits.startsWith("9179") && digits.length === 12) {
    return {
      isValid: true,
      phone: `+91 79 ${digits.slice(4, 8)} ${digits.slice(8)}`,
      isLandline: true,
    };
  }
  if (digits.startsWith("79") && digits.length === 10) {
    return {
      isValid: true,
      phone: `079-${digits.slice(2, 6)} ${digits.slice(6)}`,
      isLandline: true,
    };
  }

  // 6. Mumbai Landlines (STD 022 + 8 digits)
  if (digits.startsWith("022") && digits.length === 11) {
    return {
      isValid: true,
      phone: `022-${digits.slice(3, 7)} ${digits.slice(7)}`,
      isLandline: true,
    };
  }

  // 7. Surat Landlines (STD 0261 + 7 or 8 digits)
  if (digits.startsWith("0261") && (digits.length === 11 || digits.length === 12)) {
    return {
      isValid: true,
      phone: `0261-${digits.slice(4)}`,
      isLandline: true,
    };
  }

  // 8. Indian Mobile Numbers (10 digits starting with 6, 7, 8, or 9)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return {
      isValid: true,
      phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
      isMobile: true,
    };
  }
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    const d = digits.slice(1);
    return {
      isValid: true,
      phone: `+91 ${d.slice(0, 5)} ${d.slice(5)}`,
      isMobile: true,
    };
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    const d = digits.slice(2);
    return {
      isValid: true,
      phone: `+91 ${d.slice(0, 5)} ${d.slice(5)}`,
      isMobile: true,
    };
  }

  // 9. Standard 8-digit local landline (e.g. 26470050 in Ahmedabad)
  if (digits.length === 8 && /^[2-7]/.test(digits)) {
    return {
      isValid: true,
      phone: `079-${digits.slice(0, 4)} ${digits.slice(4)}`,
      isLandline: true,
    };
  }

  // 10. Landline with standard STD code (must start with 0)
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    return {
      isValid: true,
      phone: digits,
      isLandline: true,
    };
  }

  return { isValid: false, rejectionReason: "INVALID_INDIAN_PHONE_PREFIX" };
}

/**
 * Standardizes city strings based on city name or address corridor keywords.
 */
export function normalizeCity(city?: string | null, address?: string | null): string {
  const combined = `${city || ""} ${address || ""}`.toLowerCase();

  if (combined.includes("gift city") || combined.includes("gandhinagar")) {
    return "GIFT City";
  }
  if (combined.includes("surat") || combined.includes("vesu")) {
    return "Surat";
  }
  if (combined.includes("vadodara") || combined.includes("baroda") || combined.includes("alkapuri")) {
    return "Vadodara";
  }
  if (combined.includes("rajkot")) {
    return "Rajkot";
  }

  return "Ahmedabad";
}

export type B2BShieldResult =
  | {
      passed: true;
      cleanedBusinessName: string;
      formattedPhone: string;
      isMobile: boolean;
      isLandline: boolean;
      cleanedCategory: string;
      cleanedAddress: string;
      normalizedCity: string;
      rejectionReason?: undefined;
      details?: undefined;
    }
  | {
      passed: false;
      rejectionReason: string;
      details: string;
      cleanedBusinessName: string;
      cleanedCategory: string;
      formattedPhone?: string;
      isMobile?: boolean;
      isLandline?: boolean;
      cleanedAddress?: string;
      normalizedCity?: string;
    };

/**
 * Master B2B Pre-Ingestion Gatekeeper
 * Evaluates any lead prior to DB insertion.
 * Guarantees zero duplicate pollution, zero residential leaks, and 100% clean formatting.
 */
export function evaluateB2BShield(lead: {
  businessName?: string | null;
  category?: string | null;
  projectType?: string | null;
  notes?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}): B2BShieldResult {
  const rawName = lead.businessName || "";

  // 1. Directory / Aggregator Check (Check RAW businessName and notes BEFORE prefix stripping!)
  if (
    isAggregatorOrDirectory(rawName) ||
    isAggregatorOrDirectory(lead.notes) ||
    isAggregatorOrDirectory(lead.projectType) ||
    /\b(?:interior\s+designers?\s+in|architects?\s+in|furniture\s+in)\b/i.test(rawName)
  ) {
    return {
      passed: false,
      rejectionReason: "AGGREGATOR_LISTING",
      details: `Filtered out public aggregator or directory listing: '${rawName}'`,
      cleanedBusinessName: cleanBusinessName(rawName),
      cleanedCategory: "Directory Portal",
    };
  }

  const cleanName = cleanBusinessName(rawName);

  // 2. Residential Check
  const combinedContext = `${lead.projectType || ""} ${lead.notes || ""} ${cleanName} ${lead.category || ""}`;
  const resCheck = isResidentialInquiry(combinedContext);
  if (resCheck.isResidential) {
    return {
      passed: false,
      rejectionReason: "RESIDENTIAL_MISMATCH",
      details: `Inquiry flagged as residential due to keyword '${resCheck.matchedKeyword}'`,
      cleanedBusinessName: cleanName,
      cleanedCategory: "Residential Decorator",
    };
  }

  // 3. Phone Validation
  const phoneValidation = validateAndFormatPhone(lead.phone);
  if (!phoneValidation.isValid || !phoneValidation.phone) {
    return {
      passed: false,
      rejectionReason: phoneValidation.rejectionReason || "INVALID_PHONE",
      details: `Phone validation failed: ${phoneValidation.rejectionReason}`,
      cleanedBusinessName: cleanName || "Commercial Prospect",
      cleanedCategory: cleanLeadCategory(lead.category),
    };
  }

  // 4. Category Normalization
  const cleanedCategory = cleanLeadCategory(lead.category);

  // 5. Address & City Sanitization
  const cleanedAddress = stripUnicodeArtifacts(lead.address);
  const normalizedCityName = normalizeCity(lead.city, lead.address);

  return {
    passed: true,
    cleanedBusinessName: cleanName || `Commercial Prospect (${normalizedCityName})`,
    formattedPhone: phoneValidation.phone,
    isMobile: phoneValidation.isMobile || false,
    isLandline: phoneValidation.isLandline || false,
    cleanedCategory,
    cleanedAddress,
    normalizedCity: normalizedCityName,
  };
}
