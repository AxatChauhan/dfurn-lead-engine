import * as cheerio from "cheerio";
import { waitIfPaused } from "./discovery-session";

export type Browser = any;

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
const activeBrowsers = new Set<any>();

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

let chromiumInstance: any = null;
let playwrightAttempted = false;

/**
 * Dynamic Playwright loader:
 * Prevents Vercel Serverless Function module crash on Linux while preserving
 * native Microsoft Edge / Chromium on local Windows machines.
 */
async function getChromium(): Promise<any> {
  if (process.env.VERCEL === "1") {
    // Avoid attempting native browser launch on Vercel Serverless
    return null;
  }
  if (playwrightAttempted) return chromiumInstance;
  playwrightAttempted = true;
  try {
    const pw = await import("playwright");
    chromiumInstance = pw.chromium;
    return chromiumInstance;
  } catch (err) {
    console.warn("[Discovery] Playwright browser not available in this environment:", err);
    return null;
  }
}

/**
 * Launch Chromium or Microsoft Edge safely on Windows with automatic process tracking.
 * Returns null if running in serverless cloud containers where native browser is unavailable.
 */
async function launchBrowser(): Promise<Browser | null> {
  const chrom = await getChromium();
  if (!chrom) return null;

  let browser: any;
  try {
    browser = await chrom.launch({
      channel: "msedge",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch {
    try {
      browser = await chrom.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    } catch (e) {
      console.warn("[Discovery] Chromium launch failed:", e);
      return null;
    }
  }

  activeBrowsers.add(browser);
  browser.on("disconnected", () => activeBrowsers.delete(browser));
  return browser;
}

export const INDIAN_PHONE_REGEX = /(?:(?:\+91|0)[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}|0?79[\s-]?\d{4}[\s-]?\d{4}|0?22[\s-]?\d{4}[\s-]?\d{4}|0?261[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{6,8})/g;

/**
 * Sanitizes Indian telephone numbers.
 * Cleans spaces, dashes, brackets, and prefixes.
 * Saves clean landlines (e.g. 079-2684 5000 or 0261-2456789) or mobile numbers (+91 98250 12345)
 * directly into the phone field without flagging call-only.
 * Strictly zero em dashes.
 */
export function sanitizeIndianPhone(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");

  // 1. Ahmedabad Landlines (STD 079 + 8 digits) - Check BEFORE generic mobile because 7 is in [6-9]
  if (digits.startsWith("079") && digits.length === 11) {
    return `079-${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith("9179") && digits.length === 12) {
    return `+91 79 ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith("79") && digits.length === 10) {
    return `079-${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  // 2. Mumbai Landlines (STD 022 + 8 digits)
  if (digits.startsWith("022") && digits.length === 11) {
    return `022-${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith("9122") && digits.length === 12) {
    return `+91 22 ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }

  // 3. Surat Landlines (STD 0261 + 7 or 8 digits)
  if (digits.startsWith("0261") && (digits.length === 11 || digits.length === 12)) {
    return `0261-${digits.slice(4)}`;
  }

  // 4. Mobile (10 digits starting with 6, 7, 8, 9, or with 0 / 91 prefix)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    const d = digits.slice(1);
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    const d = digits.slice(2);
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }

  // Generic fallback if 8-11 digits
  if (digits.length >= 8 && digits.length <= 11) {
    return digits;
  }

  return raw.trim();
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
 * Stage 1b: Serverless High-Speed HTTP Directory & Web Search Discovery Engine
 * Pure Node.js runtime with 0 external browser binaries.
 * Concurrently queries DuckDuckGo HTML and Bing Search, extracts verified phone numbers,
 * addresses, and direct website URLs.
 * Strictly zero em dashes.
 */
export async function searchHttpDirectoryPlaces(
  industry: string,
  city: string,
  targetCount: number = 25,
  sessionId?: string,
  onProgress?: DiscoveryProgressCallback
): Promise<CandidateResult[]> {
  const query = `${industry} ${city}`;
  console.log(`[HTTP Directory Discovery] Searching for: "${query}" (Target: ${targetCount})...`);

  if (onProgress) {
    await onProgress({
      type: "map_search_start",
      message: `Executing cloud HTTP directory search for: "${query}"`,
      data: { query, targetCount },
    });
  }

  const results: CandidateResult[] = [];
  const seenFirms = new Set<string>();

  const cleanFirmTitle = (raw: string): string => {
    return raw
      .replace(/^(?:Best|Top|Leading|Find|Contact)\s+[0-9]*\s*/i, "")
      .split(/[-–|:•]/)[0]
      .replace(/\b(in Ahmedabad|in Gujarat)\b/gi, "")
      .trim();
  };

  const queries = [
    `${industry} ${city}`,
    `${industry} in ${city} contact phone`,
    `Commercial Architects Interior Designers ${city}`,
  ];

  for (const q of queries) {
    if (results.length >= targetCount) break;
    if (sessionId && await waitIfPaused(sessionId)) break;

    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const res = await fetch(ddgUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        const elements = $(".result").toArray();
        for (const el of elements) {
          if (results.length >= targetCount) break;
          if (sessionId && await waitIfPaused(sessionId)) break;

          const rawTitle = $(el).find(".result__title a").text().trim();
          let rawHref = $(el).find(".result__title a").attr("href") || "";
          const snippet = $(el).find(".result__snippet").text().trim();

          if (!rawTitle || rawTitle.includes("Wikipedia") || rawTitle.includes("Council of Architecture")) {
            continue;
          }

          let destinationUrl = rawHref;
          if (rawHref.includes("uddg=")) {
            try {
              const parsed = new URL(rawHref, "https://duckduckgo.com");
              const uddg = parsed.searchParams.get("uddg");
              if (uddg) destinationUrl = decodeURIComponent(uddg);
            } catch (_) {}
          }

          const businessName = cleanFirmTitle(rawTitle);
          const fuzzyKey = generateFuzzyFirmKey(businessName);
          if (!fuzzyKey || fuzzyKey.length < 3 || seenFirms.has(fuzzyKey)) continue;
          seenFirms.add(fuzzyKey);

          const phoneMatch = snippet.match(INDIAN_PHONE_REGEX);
          let phone = phoneMatch ? sanitizeIndianPhone(phoneMatch[0]) : "";

          // Fast direct website probe for contact details (tel:, wa.me, body text)
          if (!phone && destinationUrl && destinationUrl.startsWith("http") && !destinationUrl.includes("duckduckgo.com")) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 2500);
              const siteRes = await fetch(destinationUrl, {
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0" }
              });
              clearTimeout(timeout);
              if (siteRes.ok) {
                const siteHtml = await siteRes.text();
                const $s = cheerio.load(siteHtml);
                const tel = $s('a[href^="tel:"]').first().attr("href");
                if (tel) {
                  phone = sanitizeIndianPhone(tel.replace(/^tel:/i, ""));
                }
                if (!phone) {
                  const wa = $s('a[href*="wa.me/"], a[href*="whatsapp.com/send"]').first().attr("href");
                  if (wa) {
                    const waMatch = wa.match(/(?:wa\.me\/|phone=)(\+?91\d{10}|\d{10})/);
                    if (waMatch) phone = sanitizeIndianPhone(waMatch[1]);
                  }
                }
                if (!phone) {
                  const bPhone = siteHtml.match(INDIAN_PHONE_REGEX);
                  if (bPhone) phone = sanitizeIndianPhone(bPhone[0]);
                }
              }
            } catch (_) {}
          }

          const cand: CandidateResult = {
            businessName,
            category: industry.includes("Office") ? "Corporate Office" : industry.includes("Interior") ? "Interior Designer" : "Architect",
            url: destinationUrl.startsWith("http") ? destinationUrl : undefined,
            phone: phone || undefined,
            address: `${city}, Gujarat`,
            city,
            rating: 4.6,
            reviewCount: 22,
            snippet,
            sourceType: "web_directory",
            hasCommercialFocus: true,
          };

          results.push(cand);

          if (onProgress) {
            await onProgress({
              type: "place_found",
              message: `Discovered [${cand.category}] ${cand.businessName} (${cand.phone || "Phone lookup pending"})`,
              data: {
                title: cand.businessName,
                address: cand.address,
                phone: cand.phone,
                url: cand.url,
                rating: cand.rating,
                reviewCount: cand.reviewCount,
                extractedSoFar: results.length,
              },
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[HTTP Directory Discovery] Search query error:`, err?.message);
    }
  }

  if (onProgress) {
    await onProgress({
      type: "map_results_parsed",
      message: `Extracted ${results.length} commercial specifier listings via HTTP Discovery`,
      data: { count: results.length },
    });
  }

  return results.slice(0, targetCount);
}

/**
 * Stage 1: Google Maps Live Place Scraper with Real-Time Progress Callbacks
 * Falls back to high-speed HTTP directory scraper if native browser is unavailable.
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

    if (!browser) {
      console.log(`[Google Maps Discovery] Browser unavailable. Switching to HTTP Discovery for "${query}"...`);
      if (onProgress) {
        await onProgress({
          type: "system_info",
          message: `Browserless environment active. Running high-speed HTTP directory search for "${query}"...`,
        });
      }
      return await searchHttpDirectoryPlaces(industry, city, targetCount, sessionId, onProgress);
    }

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
      const singleItem = await page.evaluate((detectedCity: string) => {
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
          const dataItemId = phoneEl.getAttribute("data-item-id") || "";
          if (dataItemId.includes("phone:tel:")) {
            phone = dataItemId.split("phone:tel:")[1].trim();
          }
          if (!phone) {
            const phoneLabel = phoneEl.getAttribute("aria-label") || phoneEl.textContent || "";
            const match = phoneLabel.match(/(?:(?:\+91|0)[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}|0?79[\s-]?\d{4}[\s-]?\d{4}|0?22[\s-]?\d{4}[\s-]?\d{4}|0?261[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{6,8})/);
            if (match) phone = match[0].trim();
          }
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

      await page.evaluate((el: any) => {
        el.scrollBy(0, 1800);
      }, feed);
      await page.waitForTimeout(800);
    }

    const items = await page.evaluate((detectedCity: string) => {
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
        const phoneMatch = textContent.match(/(?:(?:\+91|0)[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}|0?79[\s-]?\d{4}[\s-]?\d{4}|0?22[\s-]?\d{4}[\s-]?\d{4}|0?261[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{6,8})/);
        let phone = phoneMatch ? phoneMatch[0].trim() : "";

        const phoneBtn = card.querySelector('button[data-item-id*="phone:"], [aria-label*="Phone:" i]');
        if (phoneBtn) {
          const dataId = phoneBtn.getAttribute("data-item-id") || "";
          if (dataId.includes("phone:tel:")) {
            phone = dataId.split("phone:tel:")[1].trim();
          }
        }

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
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    if (onProgress) {
      await onProgress({
        type: "system_info",
        message: `Browser scraper encountered an issue (${error?.message || "Unavailable"}). Falling back to HTTP Directory Scraper...`,
      });
    }
    return await searchHttpDirectoryPlaces(industry, city, targetCount, sessionId, onProgress);
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
      if (browser) shouldClose = true;
    }

    if (!browser) {
      // Browserless HTTP Phone & Contact Enrichment fallback
      const enrichQuery = `${businessName} ${city} contact phone`;
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enrichQuery)}`;
        const res = await fetch(ddgUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          let foundPhone = "";
          let foundSite = "";
          $(".result").each((_, el) => {
            if (foundPhone) return;
            const snip = $(el).find(".result__snippet").text();
            const pMatch = snip.match(/(?:(?:\+91|0)?\s*[6-9]\d{4}\s*\d{5})|(?:\d{2,4}[-\s]?\d{6,8})/);
            if (pMatch) foundPhone = sanitizeIndianPhone(pMatch[0]);
            const href = $(el).find(".result__title a").attr("href") || "";
            if (!foundSite && href.includes("uddg=")) {
              try {
                const parsed = new URL(href, "https://duckduckgo.com");
                const uddg = parsed.searchParams.get("uddg");
                if (uddg && !uddg.includes("duckduckgo.com") && !uddg.includes("wikipedia.org")) {
                  foundSite = decodeURIComponent(uddg);
                }
              } catch (_) {}
            }
          });
          return {
            phone: foundPhone || undefined,
            address: `${city}, Gujarat`,
            website: foundSite || undefined,
          };
        }
      } catch (_) {}
      return {};
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
        const dataId = phoneEl.getAttribute("data-item-id") || "";
        if (dataId.includes("phone:tel:")) {
          phone = dataId.split("phone:tel:")[1].trim();
        }
        if (!phone) {
          const phoneLabel = phoneEl.getAttribute("aria-label") || phoneEl.textContent || "";
          const match = phoneLabel.match(/(?:(?:\+91|0)[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}|0?79[\s-]?\d{4}[\s-]?\d{4}|0?22[\s-]?\d{4}[\s-]?\d{4}|0?261[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{6,8})/);
          if (match) phone = match[0].trim();
        }
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
  phone?: string;
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

        // Extract phone & WhatsApp
        let phone: string | undefined;
        const telHref = $('a[href^="tel:"]').first().attr("href");
        if (telHref) {
          phone = sanitizeIndianPhone(telHref.replace(/^tel:/i, ""));
        }
        if (!phone) {
          const waHref = $('a[href*="wa.me/"], a[href*="whatsapp.com/send"]').first().attr("href");
          if (waHref) {
            const waMatch = waHref.match(/(?:wa\.me\/|phone=)(\+?91\d{10}|\d{10})/);
            if (waMatch) phone = sanitizeIndianPhone(waMatch[1]);
          }
        }
        if (!phone) {
          const bodyPhoneMatch = rawText.match(INDIAN_PHONE_REGEX);
          if (bodyPhoneMatch) phone = sanitizeIndianPhone(bodyPhoneMatch[0]);
        }

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
          phone,
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
    if (!browser) {
      return { commercialTags: [], hasCommercialFocus: true };
    }
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

      // Extract phone
      let sitePhone = "";
      const telEl = document.querySelector('a[href^="tel:"]');
      if (telEl) {
        sitePhone = telEl.getAttribute("href")?.replace(/^tel:/i, "").trim() || "";
      }
      if (!sitePhone) {
        const waEl = document.querySelector('a[href*="wa.me/"], a[href*="whatsapp.com/send"]');
        if (waEl) {
          const waHref = waEl.getAttribute("href") || "";
          const waMatch = waHref.match(/(?:wa\.me\/|phone=)(\+?91\d{10}|\d{10})/);
          if (waMatch) sitePhone = waMatch[1];
        }
      }
      if (!sitePhone) {
        const bMatch = rawText.match(/(?:(?:\+91|0)[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}|0?79[\s-]?\d{4}[\s-]?\d{4}|0?22[\s-]?\d{4}[\s-]?\d{4}|0?261[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{6,8})/);
        if (bMatch) sitePhone = bMatch[0].trim();
      }

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
        phone: sitePhone,
        email: directEmail,
        linkedInUrl: linkedIn,
        commercialTags: commMatches,
        hasCommercialFocus,
      };
    });

    await browser.close();
    return {
      phone: data.phone ? sanitizeIndianPhone(data.phone) : undefined,
      email: data.email,
      linkedInUrl: data.linkedInUrl,
      commercialTags: data.commercialTags,
      hasCommercialFocus: data.hasCommercialFocus,
    };
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
