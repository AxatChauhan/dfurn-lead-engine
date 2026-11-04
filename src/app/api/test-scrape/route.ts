import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "Commercial Architects in sindhu bhavan ahmedabad";
  const results: any = {};

  // 1. Google Web Search
  try {
    const gUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&num=20`;
    const res = await fetch(gUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    const isSorry = html.includes("/sorry/index") || res.url.includes("/sorry/");
    const $ = cheerio.load(html);
    
    // Extract local pack / business listings if present
    const localBusinesses: string[] = [];
    $('[data-attrid*="title"], div[role="heading"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 3 && text.length < 80) localBusinesses.push(text);
    });

    results.googleSearch = {
      status: res.status,
      length: html.length,
      finalUrl: res.url,
      isCaptcha: isSorry,
      localBusinesses: localBusinesses.slice(0, 10),
    };
  } catch (e: any) {
    results.googleSearch = { error: e.message };
  }

  // 2. Google Maps Search URL
  try {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=en`;
    const res = await fetch(mapsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();
    results.googleMaps = {
      status: res.status,
      length: html.length,
      isSorry: html.includes("/sorry/index") || res.url.includes("/sorry/"),
    };
  } catch (e: any) {
    results.googleMaps = { error: e.message };
  }

  return NextResponse.json(results);
}
