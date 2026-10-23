export interface ScoringInput {
  businessName: string;
  category?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  hasCommercialFocus?: boolean | null;
  whatsappAvailable?: boolean | null;
  portfolioTags?: string[] | null;
  decisionMakersCount?: number | null;
}

export interface ScoringOutput {
  totalScore: number;
  leadTier: "A+" | "A" | "B" | "C" | "D";
  fitScore: number;
  scaleScore: number;
  activityScore: number;
  accessibilityScore: number;
  synergyScore: number;
  reasoning: string;
  recommendedHook: string;
}

export function evaluateModularLeadScore(input: ScoringInput): ScoringOutput {
  // 1. Fit Score (0–100)
  let fitScore = 40;
  const cat = (input.category || "").toLowerCase();
  if (cat.includes("architect")) fitScore = 95;
  else if (cat.includes("fitout") || cat.includes("contractor")) fitScore = 100;
  else if (cat.includes("interior")) fitScore = 85;
  else if (cat.includes("coworking")) fitScore = 80;

  // 2. Commercial Scale Score (0–100)
  let scaleScore = 20;
  if (input.hasCommercialFocus) scaleScore += 40;
  if (input.portfolioTags && input.portfolioTags.includes("Commercial Office")) scaleScore += 25;
  if (input.portfolioTags && input.portfolioTags.includes("Turnkey Fitout")) scaleScore += 15;
  scaleScore = Math.min(100, scaleScore);

  // 3. Activity Score (0–100)
  let activityScore = 30;
  if (input.website && !input.website.includes("facebook.com")) activityScore += 20;
  if (input.rating && input.rating >= 4.0) activityScore += 20;
  if (input.reviewCount && input.reviewCount >= 10) activityScore += 20;
  if (input.reviewCount && input.reviewCount >= 30) activityScore += 10;
  activityScore = Math.min(100, activityScore);

  // 4. Accessibility Score (0–100)
  let accessibilityScore = 10;
  if (input.phone) accessibilityScore += 35;
  if (input.whatsappAvailable) accessibilityScore += 25;
  if (input.email) accessibilityScore += 30;
  accessibilityScore = Math.min(100, accessibilityScore);

  // 5. OEM Synergy Score (0–100)
  let synergyScore = 30;
  if (input.portfolioTags && input.portfolioTags.includes("Modular Workstations")) synergyScore += 40;
  if (input.portfolioTags && input.portfolioTags.includes("Turnkey Fitout")) synergyScore += 30;
  synergyScore = Math.min(100, synergyScore);

  // Weighted Total Calculation
  const totalScore = Math.round(
    0.30 * fitScore +
    0.25 * scaleScore +
    0.20 * activityScore +
    0.15 * accessibilityScore +
    0.10 * synergyScore
  );

  // Assign Tier
  let leadTier: "A+" | "A" | "B" | "C" | "D" = "C";
  if (totalScore >= 85) leadTier = "A+";
  else if (totalScore >= 70) leadTier = "A";
  else if (totalScore >= 55) leadTier = "B";
  else if (totalScore >= 40) leadTier = "C";
  else leadTier = "D";

  // Formulate Reasoning & Recommended Hook
  const reasons: string[] = [];
  if (fitScore >= 85) reasons.push(`High ICP match (${input.category || "Studio"})`);
  if (input.hasCommercialFocus) reasons.push("Verified commercial office footprint");
  if (input.whatsappAvailable) reasons.push("Direct WhatsApp channel confirmed");
  if (input.reviewCount && input.reviewCount > 15) reasons.push(`Established presence (${input.reviewCount} reviews)`);

  let recommendedHook = "architect_swatch_box";
  if (cat.includes("contractor") || cat.includes("fitout")) {
    recommendedHook = "contractor_overflow_capacity";
  } else if (cat.includes("coworking")) {
    recommendedHook = "direct_workstation_supply";
  }

  return {
    totalScore,
    leadTier,
    fitScore,
    scaleScore,
    activityScore,
    accessibilityScore,
    synergyScore,
    reasoning: reasons.join(" · ") || "Standard baseline profile",
    recommendedHook,
  };
}
