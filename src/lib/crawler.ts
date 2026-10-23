import * as cheerio from "cheerio";

export interface CrawlResult {
  phone?: string;
  email?: string;
  decisionMakers: { name: string; title: string }[];
  portfolioTags: string[];
  hasCommercialFocus: boolean;
  whatsappAvailable: boolean;
  instagramUrl?: string;
  linkedinUrl?: string;
  rawSignals: string[];
}

export async function crawlFirmWebsite(websiteUrl: string): Promise<CrawlResult> {
  const result: CrawlResult = {
    decisionMakers: [],
    portfolioTags: [],
    hasCommercialFocus: false,
    whatsappAvailable: false,
    rawSignals: [],
  };

  if (!websiteUrl || !websiteUrl.startsWith("http")) {
    return result;
  }

  try {
    const mainHtml = await fetchWithTimeout(websiteUrl, 8000);
    if (!mainHtml) return result;

    const $ = cheerio.load(mainHtml);
    extractContactsFromDom($, result);
    extractSignalsFromDom($, result);

    // Look for About, Team, Contact, and Portfolio links
    const subpageLinks = findSubpageLinks($, websiteUrl);

    for (const link of subpageLinks.slice(0, 3)) {
      try {
        const subHtml = await fetchWithTimeout(link, 6000);
        if (subHtml) {
          const sub$ = cheerio.load(subHtml);
          extractContactsFromDom(sub$, result);
          extractSignalsFromDom(sub$, result);
          extractDecisionMakers(sub$, result);
        }
      } catch {
        // Continue if a subpage fails
      }
    }
  } catch (err) {
    console.error(`[Crawler] Error scraping ${websiteUrl}:`, err);
  }

  return result;
}

async function fetchWithTimeout(url: string, timeoutMs: number = 7000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function findSubpageLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>();
  const baseHost = safeGetHost(baseUrl);

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const lowerHref = href.toLowerCase();
    const isTargetPage =
      lowerHref.includes("about") ||
      lowerHref.includes("team") ||
      lowerHref.includes("contact") ||
      lowerHref.includes("project") ||
      lowerHref.includes("portfolio");

    if (isTargetPage) {
      try {
        const resolved = new URL(href, baseUrl).toString();
        if (safeGetHost(resolved) === baseHost && !resolved.includes("#")) {
          links.add(resolved);
        }
      } catch {}
    }
  });

  return Array.from(links);
}

function extractContactsFromDom($: cheerio.CheerioAPI, result: CrawlResult) {
  const text = $("body").text();

  // Extract phone numbers (Indian mobile patterns: +91 / 0 followed by 6/7/8/9 and 9 digits)
  if (!result.phone) {
    const telLink = $("a[href^='tel:']").first().attr("href");
    if (telLink) {
      result.phone = telLink.replace("tel:", "").trim();
    } else {
      const match = text.match(/(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}/);
      if (match) {
        result.phone = match[0].trim();
      }
    }
  }

  // Detect WhatsApp suitability (10 digit Indian mobile)
  if (result.phone) {
    const digitsOnly = result.phone.replace(/\D/g, "");
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
      result.whatsappAvailable = true;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
      result.whatsappAvailable = true;
    }
  }

  // Extract Email
  if (!result.email) {
    const mailLink = $("a[href^='mailto:']").first().attr("href");
    if (mailLink) {
      result.email = mailLink.replace("mailto:", "").split("?")[0].trim();
    } else {
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch && !emailMatch[0].includes("example.com") && !emailMatch[0].includes("wixpress")) {
        result.email = emailMatch[0];
      }
    }
  }

  // Extract Instagram and LinkedIn
  $("a[href*='instagram.com']").each((_, el) => {
    const h = $(el).attr("href");
    if (h && !h.includes("/p/") && !result.instagramUrl) result.instagramUrl = h;
  });
  $("a[href*='linkedin.com']").each((_, el) => {
    const h = $(el).attr("href");
    if (h && (h.includes("/company/") || h.includes("/in/")) && !result.linkedinUrl) result.linkedinUrl = h;
  });
}

function extractSignalsFromDom($: cheerio.CheerioAPI, result: CrawlResult) {
  const text = $("body").text().toLowerCase();

  const commercialKeywords = [
    "commercial office",
    "corporate office",
    "workstations",
    "coworking",
    "turnkey fitout",
    "sq ft",
    "conference room",
    "executive cabin",
    "interior contractor",
  ];

  for (const kw of commercialKeywords) {
    if (text.includes(kw) && !result.rawSignals.includes(kw)) {
      result.rawSignals.push(kw);
      result.hasCommercialFocus = true;
    }
  }

  // Portfolio tags
  if (text.includes("commercial") || text.includes("corporate")) {
    if (!result.portfolioTags.includes("Commercial Office")) result.portfolioTags.push("Commercial Office");
  }
  if (text.includes("turnkey") || text.includes("fitout")) {
    if (!result.portfolioTags.includes("Turnkey Fitout")) result.portfolioTags.push("Turnkey Fitout");
  }
  if (text.includes("workstation") || text.includes("modular")) {
    if (!result.portfolioTags.includes("Modular Workstations")) result.portfolioTags.push("Modular Workstations");
  }
  if (text.includes("residential") || text.includes("villa") || text.includes("penthouse")) {
    if (!result.portfolioTags.includes("Luxury Residential")) result.portfolioTags.push("Luxury Residential");
  }
}

function extractDecisionMakers($: cheerio.CheerioAPI, result: CrawlResult) {
  const titles = [
    "Principal Architect",
    "Founding Partner",
    "Founder & Principal Architect",
    "Design Director",
    "Managing Director",
    "Lead Architect",
    "Creative Director",
  ];

  $("h2, h3, h4, strong, p").each((_, el) => {
    const raw = $(el).text().trim();
    for (const title of titles) {
      if (raw.toLowerCase().includes(title.toLowerCase())) {
        // Attempt to find the name in sibling or parent element
        const nameCandidate = $(el).prev().text().trim() || $(el).parent().find("h3, h4").first().text().trim();
        if (nameCandidate && nameCandidate.length > 2 && nameCandidate.length < 50 && !result.decisionMakers.some((d) => d.name === nameCandidate)) {
          result.decisionMakers.push({
            name: nameCandidate,
            title,
          });
        }
      }
    }
  });
}

function safeGetHost(urlStr: string): string {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return "";
  }
}
