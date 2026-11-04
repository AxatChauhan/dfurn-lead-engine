import * as cheerio from "cheerio";
import { chromium, Browser } from "playwright";
import { waitIfPaused } from "./discovery-session";

export interface CandidateResult {
  businessName: string;
  category: string; // Architect, Interior Designer, Fitout Contractor, Coworking
  url?: string;
  phone?: string;
  address?: string;
  city: string;
  rating?: number;
  reviewCount?: number;
  snippet?: string;
  sourceType: string; // google_maps, bing_search, directory
  email?: string;
  linkedInUrl?: string;
  commercialTags?: string[];
  hasCommercialFocus?: boolean;
}

export type DiscoveryProgressCallback = (event: {
  type: string;
  message: string;
  data?: any;
}) => Promise<void> | void;

/**
 * Global registry of active Playwright browsers for clean termination on Windows.
 * Prevents orphaned msedge.exe / chromium.exe background processes.
 */
const activeBrowsers = new Set<Browser>();

const cleanupAllBrowsers = async () => {
  for (const b of activeBrowsers) {
    try {
      await b.close();
    } catch (_) {}
  }
  activeBrowsers.clear();
};

if (typeof process !== "undefined") {
  process.on("exit", () => { cleanupAllBrowsers(); });
  process.on("SIGINT", () => { cleanupAllBrowsers(); process.exit(0); });
  process.on("SIGTERM", () => { cleanupAllBrowsers(); process.exit(0); });
}

/**
 * Launch Chromium or Microsoft Edge safely on Windows with automatic process tracking.
 */
async function launchBrowser(): Promise<Browser> {
  let browser: Browser;
  try {
    browser = await chromium.launch({
      channel: "msedge",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  activeBrowsers.add(browser);
  browser.on("disconnected", () => activeBrowsers.delete(browser));
  return browser;
}

/**
 * Sanitizes Indian telephone numbers.
 * Cleans spaces, dashes, brackets, and prefixes.
 * Saves clean landlines (e.g. 079-26851234 or 0261-2456789) or mobile numbers (+91 98250 12345)
 * directly into the phone field without flagging call-only.
 */
export function sanitizeIndianPhone(raw?: string | null): string {
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d+]/g, "").trim();

  // Strip international +91 or 91 prefix
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // Remove leading 0 if 11 digits and starts with 06/07/08/09 (mobile with STD 0)
  if (cleaned.startsWith("0") && cleaned.length === 11 && /^[6-9]/.test(cleaned.slice(1))) {
    cleaned = cleaned.slice(1);
  }

  // 10-digit mobile number starting with 6, 7, 8, 9
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  // Landline number (e.g. 079-26851234, 0261-2456789)
  if (cleaned.length >= 8 && cleaned.length <= 11) {
    if (!cleaned.startsWith("0") && cleaned.length === 10 && cleaned.startsWith("79")) {
      cleaned = "0" + cleaned;
    }
    if (cleaned.startsWith("0")) {
      const stdLen = cleaned.startsWith("022") || cleaned.startsWith("079") || cleaned.startsWith("011") || cleaned.startsWith("080") || cleaned.startsWith("044") ? 3 : 4;
      return `${cleaned.slice(0, stdLen)}-${cleaned.slice(stdLen)}`;
    }
    return cleaned;
  }

  return cleaned || (raw || "").trim();
}

/**
 * Generates a normalized fuzzy key for firm deduplication.
 * Strips punctuation, whitespace, and common noise suffix words.
 */
export function generateFuzzyFirmKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(architects?|interiors?|designers?|design|studio|consultants?|pvt|ltd|private|limited|llp|associates?|group|enterprises?)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Stage 1: Google Maps Live Place Scraper with Real-Time Progress Callbacks
 * Strictly zero em dashes.
 */
export async function searchGoogleMaps(
  industry: string,
  city: string,
  targetCount: number = 25,
  sessionId?: string,
  onProgress?: DiscoveryProgressCallback
): Promise<CandidateResult[]> {
  const query = `${industry} in ${city}`;
  console.log(`[Google Maps Discovery] Searching for: "${query}" (Target: ${targetCount})...`);

  if (onProgress) {
    await onProgress({
      type: "map_search_start",
      message: `Launching browser for query: "${query}"`,
      data: { query, targetCount },
    });
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });

    const page = await context.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Check pause/cancel
    if (sessionId && await waitIfPaused(sessionId)) {
      await browser.close();
      return [];
    }

    // Accept consent if shown
    const consentBtn = await page.$('button[aria-label*="Accept all"], button[aria-label*="Agree"]');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(600);
    }

    // Locate the scrollable feed safely
    let feed = await page.waitForSelector('div[role="feed"]', { timeout: 6000 }).catch(() => null);

    // Edge Case EC-01: Check if Google Maps redirected directly to a single place card
    const currentUrl = page.url();
    if (!feed && currentUrl.includes("/maps/place/")) {
      console.log(`[Google Maps Discovery] Direct single place redirected: ${currentUrl}`);
      const singleItem = await page.evaluate((detectedCity) => {
        const titleEl = document.querySelector('h1.DUwDvf, h1');
        const businessName = titleEl ? (titleEl.textContent || "").trim() : "";
        if (!businessName) return null;

        let website = "";
        const webLink = document.querySelector('a[data-item-id="authority"], a[aria-label*="website" i]');
        if (webLink) {
          const href = webLink.getAttribute("href") || "";
          website = href.includes("google.com/url?q=")
            ? new URL(href).searchParams.get("q") || href
            : href;
        }

        let phone = "";
        const phoneEl = document.querySelector('button[data-item-id*="phone:"], [aria-label*="Phone:" i]');
        if (phoneEl) {
          const phoneLabel = phoneEl.getAttribute("aria-label") || phoneEl.textContent || "";
          const match = phoneLabel.match(/(?:(?:\+91|0)?\s*[6-9]\d{4}\s*\d{5})|(?:\d{2,4}[-\s]?\d{6,8})/);
          if (match) phone = match[0].trim();
        }

        let rating = 0;
        let reviewCount = 0;
        const ratingSpan = document.querySelector('span[aria-label*="stars"], span.ceNzKf');
        if (ratingSpan) {
          const rMatch = (ratingSpan.getAttribute("aria-label") || ratingSpan.textContent || "").match(/([0-9.]+)/);
          if (rMatch) rating = parseFloat(rMatch[1]);
        }
        const revSpan = document.querySelector('span[aria-label*="reviews"]');
        if (revSpan) {
          const cMatch = (revSpan.getAttribute("aria-label") || revSpan.textContent || "").match(/([0-9,]+)/);
          if (cMatch) reviewCount = parseInt(cMatch[1].replace(/,/g, ""), 10) || 0;
        }

        let address = detectedCity;
        const addrBtn = document.querySelector('button[data-item-id="address"]');
        if (addrBtn) {
          address = (addrBtn.getAttribute("aria-label") || addrBtn.textContent || "")
            .replace(/^Address:\s*/i, "")
            .trim();
        }

        return {
          businessName,
          website,
          phone,
          address: address || detectedCity,
          rating,
          reviewCount,
          snippet: document.body?.innerText?.slice(0, 160) || "",
        };
      }, city);

      if (singleItem && singleItem.businessName) {
        await browser.close();
        browser = null;
        const sanitizedPhone = sanitizeIndianPhone(singleItem.phone);
        const result: CandidateResult = {
          businessName: singleItem.businessName,
          category: categorizeFirm(singleItem.businessName, industry),
          url: singleItem.website || undefined,
          phone: sanitizedPhone || undefined,
          address: singleItem.address,
          city,
          rating: singleItem.rating,
          reviewCount: singleItem.reviewCount,
          snippet: singleItem.snippet,
          sourceType: "google_maps",
        };
        if (onProgress) {
          await onProgress({
            type: "map_results_parsed",
            message: `Extracted direct listing: ${singleItem.businessName}`,
            data: { count: 1 },
          });
        }
        return [result];
      }
    }

    if (!feed) {
      console.warn("[Google Maps Discovery] No feed found.");
      if (onProgress) {
        await onProgress({
          type: "map_no_feed",
          message: "Google Maps feed not detected for this corridor. Querying public directory fallback...",
        });
      }
      await browser.close();
      return [];
    }

    // Dynamic scrolling until targetCount reached or bottom of feed detected
    console.log(`[Google Maps Discovery] Scrolling feed dynamically to reach ${targetCount} listings...`);
    let previousCount = 0;
    let unchangedRounds = 0;
    const maxScrolls = Math.max(Math.ceil(targetCount / 3), 8);

    for (let i = 0; i < maxScrolls; i++) {
      if (sessionId && await waitIfPaused(sessionId)) {
        console.log("[Google Maps Discovery] Session cancelled during scrolling.");
        break;
      }

      const currentCards = await page.$$('a[href*="/maps/place/"]');
      
      if (onProgress) {
        await onProgress({
          type: "map_scroll",
          message: `Scrolled feed: discovered ${currentCards.length} places (Target: ${targetCount})`,
          data: { count: currentCards.length, target: targetCount, scroll: i + 1 },
        });
      }

      if (currentCards.length >= targetCount) {
        console.log(`[Google Maps Discovery] Reached target listing count (${currentCards.length} listings).`);
        break;
      }

      if (currentCards.length === previousCount) {
        unchangedRounds++;
        if (unchangedRounds >= 3) {
          console.log(`[Google Maps Discovery] Feed reached the end for this area (${currentCards.length} listings found).`);
          break;
        }
      } else {
        unchangedRounds = 0;
      }

      previousCount = currentCards.length;

      await page.evaluate((el) => {
        el.scrollBy(0, 1800);
      }, feed);
      await page.waitForTimeout(800);
    }

    const items = await page.evaluate((detectedCity) => {
      const results: {
        businessName: string;
        website: string;
        phone: string;
        address: string;
        rating: number;
        reviewCount: number;
        snippet: string;
      }[] = [];

      const feedEl = document.querySelector('div[role="feed"]');
      if (!feedEl) return results;

      const cards = feedEl.querySelectorAll('div[jsaction*="mouseover"]');
      cards.forEach((card) => {
        const link = card.querySelector('a[href*="/maps/place/"]');
        if (!link) return;

        const businessName = (link.getAttribute("aria-label") || link.textContent || "").trim();
        if (!businessName || businessName.length < 2) return;

        // Website extraction
        let website = "";
        const webLink = card.querySelector('a[data-value="Website"], a[aria-label*="website" i]');
        if (webLink) {
          const href = webLink.getAttribute("href") || "";
          if (href.includes("google.com/url?q=")) {
            try {
              const u = new URL(href);
              website = u.searchParams.get("q") || "";
            } catch (_) {
              website = href;
            }
          } else {
            website = href;
          }
        }

        // Clean website
        if (website) {
          try {
            const parsed = new URL(website);
            parsed.search = "";
            website = parsed.toString().replace(/\/$/, "");
          } catch (_) {}
        }

        const textContent = (card as HTMLElement).innerText || "";
        const phoneMatch = textContent.match(/(?:(?:\+91|0)?\s*[6-9]\d{4}\s*\d{5})|(?:\d{2,4}[-\s]?\d{6,8})/);
        const phone = phoneMatch ? phoneMatch[0].trim() : "";

        // Extract rating and review count
        let rating = 0;
        let reviewCount = 0;
        const ratingEl = card.querySelector('span[aria-label*="stars"]');
        if (ratingEl) {
          const match = (ratingEl.getAttribute("aria-label") || "").match(/([0-9.]+)\s*stars/i);
          if (match) rating = parseFloat(match[1]);
        }
        const revMatch = textContent.match(/\(([0-9,]+)\)/);
        if (revMatch) {
          reviewCount = parseInt(revMatch[1].replace(/,/g, ""), 10) || 0;
        }

        // Extract address
        let address = detectedCity;
        const lines = textContent.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const lower = line.toLowerCase();
          if (line.includes("·") && !lower.includes("open") && !lower.includes("close") && !lower.includes("closing")) {
            const parts = line.split("·").map((p) => p.trim());
            if (parts[1]) address = parts.slice(1).join(", ");
          }
        }

        results.push({
          businessName,
          website,
          phone,
          address,
          rating,
          reviewCount,
          snippet: textContent.slice(0, 160),
        });
      });

      return results;
    }, city);

    await browser.close();
    browser = null;

    // Deduplicate with normalized fuzzy key
    const seen = new Set<string>();
    const uniqueList: CandidateResult[] = [];

    for (const it of items) {
      const fuzzyKey = generateFuzzyFirmKey(it.businessName) || it.businessName.toLowerCase();
      if (!seen.has(fuzzyKey)) {
        seen.add(fuzzyKey);
        const cleanPhone = sanitizeIndianPhone(it.phone);
        uniqueList.push({
          businessName: it.businessName,
          category: categorizeFirm(it.businessName, industry),
          url: it.website || undefined,
          phone: cleanPhone || undefined,
          address: it.address,
          city,
          rating: it.rating,
          reviewCount: it.reviewCount,
          snippet: it.snippet,
          sourceType: "google_maps",
        });
      }
    }

    if (onProgress) {
      await onProgress({
        type: "map_results_parsed",
        message: `Extracted ${uniqueList.length} unique studio listings from Google Maps`,
        data: { count: uniqueList.length },
      });
    }

    return uniqueList.slice(0, targetCount);
  } catch (error: any) {
    console.error("[Google Maps Discovery] Error:", error);
    if (browser) await browser.close();
    return [];
  }
}

/**
 * Stage 2: Web Search Discovery (Bing Fallback)
 * Fast Cheerio scraper querying Bing HTML with zero browser overhead.
 */
export async function searchBing(
  industry: string,
  city: string,
  limit: number = 15
): Promise<CandidateResult[]> {
  try {
    const query = `"${industry}" "${city}" contact architect OR "interior designer"`;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&ensearch=1&setlang=en`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: CandidateResult[] = [];

    $("li.b_algo").each((_, el) => {
      if (results.length >= limit) return false;
      const titleEl = $(el).find("h2 a");
      const title = titleEl.text().trim();
      const rawUrl = titleEl.attr("href") || "";
      const snippet = $(el).find(".b_caption p, .b_snippet").text().trim();

      if (!title || !rawUrl || rawUrl.includes("bing.com")) return;

      const phoneMatch = snippet.match(/(\+?\d{1,4}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}/);
      const cleanName = title.split(/\s*[-|\u2013\u2014:]\s*/)[0].trim();

      results.push({
        businessName: cleanName || title,
        category: categorizeFirm(title, industry),
        url: rawUrl,
        phone: phoneMatch ? phoneMatch[0].trim() : undefined,
        city,
        snippet,
        sourceType: "bing_search",
      });
    });

    return results;
  } catch (err) {
    console.error("[Bing Discovery] Error:", err);
    return [];
  }
}

/**
 * Stage 2b: Automatic Direct Studio Knowledge Panel Phone Enricher
 * When a discovered studio lacks a phone number from the initial feed scan,
 * this function queries the exact studio name on Google Maps, opening its full
 * knowledge panel to extract the verified phone button, street address, and direct website.
 * Strictly zero em dashes.
 */
export async function enrichLeadPhoneFromGoogleMaps(
  businessName: string,
  city: string,
  existingBrowser?: Browser
): Promise<{
  phone?: string;
  address?: string;
  website?: string;
}> {
  const query = `${businessName} ${city}`;
  let browser = existingBrowser;
  let shouldClose = false;

  try {
    if (!browser) {
      browser = await launchBrowser();
      shouldClose = true;
    }

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });

    const page = await context.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(800);

    // Accept consent if shown
    const consentBtn = await page.$('button[aria-label*="Accept all"], button[aria-label*="Agree"]');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(400);
    }

    // If multiple cards shown, click the top matching result to open knowledge panel
    const firstCard = await page.$('a[href*="/maps/place/"]');
    if (firstCard && !page.url().includes("/maps/place/")) {
      await firstCard.click();
      await page.waitForTimeout(800);
    }

    // Extract phone, address, and website from Knowledge Panel
    const data = await page.evaluate(() => {
      let phone = "";
      const phoneEl = document.querySelector(
        'button[data-item-id*="phone:"], [aria-label*="Phone:" i], button[data-tooltip*="phone" i]'
      );
      if (phoneEl) {
        const phoneLabel = phoneEl.getAttribute("aria-label") || phoneEl.textContent || "";
        const match = phoneLabel.match(/(?:(?:\+91|0)?\s*[6-9]\d{4}\s*\d{5})|(?:\d{2,4}[-\s]?\d{6,8})/);
        if (match) phone = match[0].trim();
      }

      // Address
      let address = "";
      const addrBtn = document.querySelector('button[data-item-id="address"], [aria-label*="Address:" i]');
      if (addrBtn) {
        address = (addrBtn.getAttribute("aria-label") || addrBtn.textContent || "")
          .replace(/^Address:\s*/i, "")
          .trim();
      }

      // Website
      let website = "";
      const webLink = document.querySelector('a[data-item-id="authority"], a[aria-label*="website" i]');
      if (webLink) {
        const href = webLink.getAttribute("href") || "";
        website = href.includes("google.com/url?q=")
          ? new URL(href).searchParams.get("q") || href
          : href;
      }

      return { phone, address, website };
    });

    await context.close();
    if (shouldClose && browser) {
      await browser.close();
    }

    const cleanPhone = sanitizeIndianPhone(data.phone);
    return {
      phone: cleanPhone || undefined,
      address: data.address || undefined,
      website: data.website || undefined,
    };
  } catch (err) {
    if (shouldClose && browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    return {};
  }
}

/**
 * Stage 3: High-Speed Website Portfolio Auditor
 * Uses high-speed HTTP + Cheerio first (200-500ms), skips social login walls (Instagram/Facebook),
 * and falls back to headless browser only when necessary.
 * Strictly zero em dashes.
 */
export async function auditCandidateWebsite(
  url: string
): Promise<{
  email?: string;
  linkedInUrl?: string;
  commercialTags: string[];
  hasCommercialFocus: boolean;
}> {
  if (!url || !url.startsWith("http")) {
    return { commercialTags: [], hasCommercialFocus: true };
  }

  // 1. Immediately bypass social media platforms (Instagram, Facebook, Twitter, Pinterest, YouTube)
  // These platforms require user login, block scrapers, and cause 15-30s timeouts.
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes("instagram.com") ||
    lowerUrl.includes("facebook.com") ||
    lowerUrl.includes("twitter.com") ||
    lowerUrl.includes("x.com") ||
    lowerUrl.includes("pinterest.com") ||
    lowerUrl.includes("youtube.com")
  ) {
    return {
      commercialTags: ["social_presence"],
      hasCommercialFocus: true,
    };
  }

  if (lowerUrl.includes("linkedin.com")) {
    return {
      commercialTags: ["linkedin_verified"],
      hasCommercialFocus: true,
      linkedInUrl: url,
    };
  }

  // 2. High-speed HTTP Fetch with Cheerio (200-500ms)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s max timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    // Guard: ignore non-HTML payloads (50MB PDFs, videos, images)
    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { commercialTags: [], hasCommercialFocus: true };
    }

    // Guard: ignore excessively large responses (>5MB)
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 5 * 1024 * 1024) {
      return { commercialTags: [], hasCommercialFocus: true };
    }

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Clean non-content tags
      $("script, style, noscript, svg, iframe").remove();
      const text = $("body").text().toLowerCase().trim();
      const rawText = $("body").text();

      // If text is suspiciously short (< 80 chars), it is likely a client-side React/Webflow SPA
      // In that scenario, fall through to the headless browser fallback
      if (text.length >= 80) {
        const commKeywords = [
          "commercial", "workplace", "office", "corporate", "turnkey",
          "workstation", "conference", "boardroom", "it park", "coworking",
          "modular furniture", "linear desking", "fitout", "fit-out"
        ];
        const resKeywords = ["kitchen", "modular kitchen", "bedroom", "living room", "2bhk", "3bhk", "villa", "bungalow"];

        const commMatches = commKeywords.filter((kw) => text.includes(kw));
        const resMatches = resKeywords.filter((kw) => text.includes(kw));

        // De-obfuscate emails (e.g. hello [at] studio [dot] com or &#64;)
        const emailRegex = /([a-zA-Z0-9._%+-]+(?:\s*\[at\]\s*|\s*\(at\)\s*|\s*&#64;\s*|@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        const mailtoLinks: string[] = [];
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr("href") || "";
          const clean = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
          if (clean && clean.includes("@")) mailtoLinks.push(clean);
        });

        const rawEmails = (rawText.match(emailRegex) || []).map((e) =>
          e.toLowerCase()
            .replace(/\s*\[at\]\s*|\s*\(at\)\s*|\s*&#64;\s*/gi, "@")
            .replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".")
        );

        const dummyDomains = [
          "example.com", "yourdomain.com", "domain.com", "sentry.io",
          "wixpress.com", "theme.com", "gravatar.com", "sample.com",
          "email.com", "test.com", "wordpress.com"
        ];

        const allEmails = Array.from(new Set([...mailtoLinks, ...rawEmails])).filter(
          (e) =>
            !e.endsWith(".png") &&
            !e.endsWith(".jpg") &&
            !e.endsWith(".webp") &&
            !dummyDomains.some((d) => e.includes(d)) &&
            e.includes("@") &&
            e.split("@")[1]?.includes(".")
        );

        const directEmail = allEmails.find((e) => !e.startsWith("info@") && !e.startsWith("contact@")) || allEmails[0];

        // Extract LinkedIn
        let linkedInUrl: string | undefined;
        $('a[href*="linkedin.com"]').each((_, el) => {
          const href = $(el).attr("href") || "";
          if ((href.includes("/in/") || href.includes("/company/")) && !linkedInUrl) {
            linkedInUrl = href;
          }
        });

        const hasCommercialFocus = commMatches.length > 0 || resMatches.length === 0;

        return {
          email: directEmail,
          linkedInUrl,
          commercialTags: commMatches,
          hasCommercialFocus,
        };
      }
    }
  } catch (_) {
    // Fast fetch timed out or failed; proceed to browser fallback
  }

  // 3. Fallback to headless browser with strict 5s timeout
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });
    await page.waitForTimeout(500);

    const data = await page.evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      const rawText = document.body?.innerText || "";

      const commKeywords = [
        "commercial", "workplace", "office", "corporate", "turnkey",
        "workstation", "conference", "boardroom", "it park", "coworking",
        "modular furniture", "linear desking", "fitout", "fit-out"
      ];
      const resKeywords = ["kitchen", "modular kitchen", "bedroom", "living room", "2bhk", "3bhk", "villa", "bungalow"];

      const commMatches = commKeywords.filter((kw) => text.includes(kw));
      const resMatches = resKeywords.filter((kw) => text.includes(kw));

      // Extract email
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
        .map((a) => (a as HTMLAnchorElement).href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase());
      const textEmails = (rawText.match(emailRegex) || []).map((e) => e.toLowerCase());
      const allEmails = Array.from(new Set([...mailtoLinks, ...textEmails]))
        .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.includes("example.com") && !e.includes("sentry.io"));

      const directEmail = allEmails.find((e) => !e.startsWith("info@") && !e.startsWith("contact@")) || allEmails[0];

      // Extract LinkedIn
      const linkedIn = Array.from(document.querySelectorAll('a[href*="linkedin.com"]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .find((h) => h.includes("/in/") || h.includes("/company/"));

      const hasCommercialFocus = commMatches.length > 0 || resMatches.length === 0;

      return {
        email: directEmail,
        linkedInUrl: linkedIn,
        commercialTags: commMatches,
        hasCommercialFocus,
      };
    });

    await browser.close();
    return data;
  } catch {
    if (browser) await browser.close();
    return { commercialTags: [], hasCommercialFocus: true };
  }
}

/**
 * Combined Multi-Source Discovery Pipeline with Optional Cognitive Portfolio Auditing & Pause/Cancel
 */
export async function runMultiSourceDiscovery(
  industry: string,
  city: string,
  targetCount: number = 30,
  runAudit: boolean = true,
  sessionId?: string,
  onProgress?: DiscoveryProgressCallback
): Promise<CandidateResult[]> {
  const gmapsResults = await searchGoogleMaps(industry, city, targetCount, sessionId, onProgress);
  let combined = [...gmapsResults];

  if (sessionId && await waitIfPaused(sessionId)) {
    return combined;
  }

  if (combined.length < targetCount) {
    const remaining = targetCount - combined.length;
    if (onProgress) {
      await onProgress({
        type: "bing_fallback_start",
        message: `Querying web directory fallback for ${remaining} additional listings...`,
        data: { remaining },
      });
    }
    const bingResults = await searchBing(industry, city, remaining + 5);
    combined = [...combined, ...bingResults];
  }

  // Deduplicate by business name
  const seen = new Set<string>();
  const unique: CandidateResult[] = [];

  for (const c of combined) {
    const normName = c.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(normName) && normName.length > 2) {
      seen.add(normName);
      unique.push(c);
    }
  }

  const selected = unique.slice(0, targetCount);

  // If audit enabled, audit candidate websites in parallel with session control & progress events
  if (runAudit) {
    console.log(`[Discovery Audit] Auditing websites for ${selected.length} candidates...`);
    for (let i = 0; i < selected.length; i++) {
      if (sessionId && await waitIfPaused(sessionId)) {
        console.log("[Discovery Audit] Session cancelled during website auditing.");
        break;
      }

      const item = selected[i];
      if (item.url) {
        if (onProgress) {
          await onProgress({
            type: "audit_start",
            message: `[${i + 1}/${selected.length}] Auditing website: ${item.businessName} (${item.url})`,
            data: { current: i + 1, total: selected.length, studio: item.businessName, url: item.url },
          });
        }

        const audit = await auditCandidateWebsite(item.url);
        item.email = audit.email;
        item.linkedInUrl = audit.linkedInUrl;
        item.commercialTags = audit.commercialTags;
        item.hasCommercialFocus = audit.hasCommercialFocus;

        if (onProgress) {
          await onProgress({
            type: "audit_complete",
            message: `Extracted signals for ${item.businessName}: ${audit.email || "No email"} · ${audit.commercialTags.length} commercial tags`,
            data: {
              current: i + 1,
              total: selected.length,
              studio: item.businessName,
              email: audit.email,
              linkedIn: audit.linkedInUrl,
              tags: audit.commercialTags,
              isCommercial: audit.hasCommercialFocus,
            },
          });
        }
      }
    }
  }

  return selected;
}

function categorizeFirm(name: string, fallback: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("architect")) return "Architect";
  if (lower.includes("interior") || lower.includes("design") || lower.includes("decor")) return "Interior Designer";
  if (lower.includes("contract") || lower.includes("fitout") || lower.includes("turnkey")) return "Fitout Contractor";
  if (lower.includes("cowork") || lower.includes("workspace") || lower.includes("office")) return "Coworking Space";
  return fallback;
}
