// Qualification and Disqualification Business Logic for D'furn Modular Systems

export function isSuspiciousDummyPhone(raw: string): boolean {
  if (!raw) return true;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return true;
  // Repeating numbers like 9999999999, 8888888888, or 0000000000
  if (/^(\d)\1{7,}$/.test(digits)) return true;
  // Common sequential tests
  if (digits.includes("123456789") || digits.includes("987654321")) return true;
  return false;
}

export function isResidentialMismatch(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("modular kitchen") ||
    lower.includes("kitchen") ||
    lower.includes("wardrobe") ||
    lower.includes("bedroom") ||
    lower.includes("2bhk") ||
    lower.includes("3bhk") ||
    lower.includes("villa") ||
    lower.includes("bungalow interior") ||
    lower.includes("apartment interior")
  );
}
