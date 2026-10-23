import * as cheerio from "cheerio";
import { chromium, Browser } from "playwright";

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
}

/**
 * Stage 1: Google Maps Live Place Scraper
 * Uses Playwright Chromium headless to extract live business profiles without API fees.
 */
export async function searchGoogleMaps(
  industry: string,
  city: string,
  targetCount: number = 25
): Promise<CandidateResult[]> {
  const query = `${industry} in ${city}`;
  console.log(`[Google Maps Discovery] Searching for: "${query}" (Target: ${targetCount})...`);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });

    const page = await context.newPage();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    try {
      await page.waitForSelector("div[role='feed'], .Nv2PK", { timeout: 8000 });
    } catch {
      // If feed didn't appear immediately, continue
    }

    // Scroll feed to load items
    const scrollCount = Math.min(Math.ceil(targetCount / 6), 6);
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        const feed = document.querySelector("div[role='feed']");
        if (feed) feed.scrollBy(0, 1500);
        else window.scrollBy(0, 1500);
      });
      await page.waitForTimeout(1000);
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

      const cards = document.querySelectorAll(".Nv2PK, div[role='article']");
      cards.forEach((card) => {
        const nameEl = card.querySelector(".qBF1Pd, .fontHeadlineSmall");
        const businessName = nameEl?.textContent?.trim() || "";
        if (!businessName || businessName.length < 2) return;

        let website = "";
        const allLinks = card.querySelectorAll("a");
        allLinks.forEach((a) => {
          const href = a.getAttribute("href") || "";
          const aria = (a.getAttribute("aria-label") || "").toLowerCase();
          if (
            aria.includes("website") ||
            (!href.includes("google.com") && href.startsWith("http")) ||
            href.includes("google.com/url?q=")
          ) {
            if (href.includes("google.com/url?q=")) {
              try {
                const u = new URL(href);
                const actual = u.searchParams.get("q");
                if (actual && !actual.includes("google.")) website = actual;
              } catch {}
            } else if (!href.includes("google.com")) {
              website = href;
            }
          }
        });

        const textContent = card.textContent || "";
        const phoneMatch = textContent.match(/(\+?\d{1,4}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}/);
        const phone = phoneMatch ? phoneMatch[0].trim() : "";

        // Extract rating and review count
        let rating = 0;
        let reviewCount = 0;
        const ratingEl = card.querySelector(".MW4etd");
        if (ratingEl && ratingEl.textContent) {
          rating = parseFloat(ratingEl.textContent.trim()) || 0;
        }
        const reviewEl = card.querySelector(".UY7F9");
        if (reviewEl && reviewEl.textContent) {
          const revMatch = reviewEl.textContent.match(/\d[\d,]*/);
          if (revMatch) {
            reviewCount = parseInt(revMatch[0].replace(/,/g, ""), 10) || 0;
          }
        }

        results.push({
          businessName,
          website,
          phone,
          address: detectedCity,
          rating,
          reviewCount,
          snippet: textContent.slice(0, 160),
        });
      });

      return results;
    }, city);

    await browser.close();
    browser = null;

    return items.map((it) => ({
      businessName: it.businessName,
      category: categorizeFirm(it.businessName, industry),
      url: it.website || undefined,
      phone: it.phone || undefined,
      address: it.address,
      city,
      rating: it.rating,
      reviewCount: it.reviewCount,
      snippet: it.snippet,
      sourceType: "google_maps",
    }));
  } catch (error) {
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
      if (results.length >= limit) return;
      const title = $(el).find("h2").text().trim();
      const rawUrl = $(el).find("h2 a").attr("href") || "";
      const snippet = $(el).find(".b_caption p, .b_snippet").text().trim();

      if (!title || !rawUrl || rawUrl.includes("bing.com")) return;

      // Extract phone from snippet if present
      const phoneMatch = snippet.match(/(\+?\d{1,4}[-.\s]?)?(\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}/);

      // Clean business name
      const cleanName = title.split(/\s*[-–|:]\s*/)[0].trim();

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
 * Combined Multi-Source Discovery Pipeline
 */
export async function runMultiSourceDiscovery(
  industry: string,
  city: string,
  targetCount: number = 30
): Promise<CandidateResult[]> {
  const gmapsResults = await searchGoogleMaps(industry, city, targetCount);
  let combined = [...gmapsResults];

  if (combined.length < targetCount) {
    const remaining = targetCount - combined.length;
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

  return unique.slice(0, targetCount);
}

function categorizeFirm(name: string, fallback: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("architect")) return "Architect";
  if (lower.includes("interior") || lower.includes("design") || lower.includes("decor")) return "Interior Designer";
  if (lower.includes("contract") || lower.includes("fitout") || lower.includes("turnkey")) return "Fitout Contractor";
  if (lower.includes("cowork") || lower.includes("workspace") || lower.includes("office")) return "Coworking Space";
  return fallback;
}
