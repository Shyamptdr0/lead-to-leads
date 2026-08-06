import { NextResponse } from "next/server";
import fs from 'fs';
import type { Lead, ScrapeInput } from "@/lib/types";
import { saveLeadToAirtable } from "@/lib/airtable";

interface ScrapeInputExtended extends ScrapeInput {
  provider?: 'local' | 'apify';
}

const CHROMIUM_CDN =
  "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

// ─── Shared Puppeteer scraper (works on Vercel + localhost) ─────────────────
async function runPuppeteerScrape(
  searchQuery: string,
  input: ScrapeInputExtended,
  targetCount: number,
  sendEvent: (data: any) => void,
) {
  const isVercel = !!process.env.VERCEL;
  let browser: any;

  try {
    if (isVercel) {
      // On Vercel: use @sparticuz/chromium-min + puppeteer-core
      const chromium = (await import("@sparticuz/chromium-min")).default;
      const puppeteerCore = (await import("puppeteer-core")).default;

      chromium.setGraphicsMode = false;

      const executablePath = await chromium.executablePath(CHROMIUM_CDN);

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 800 },
        executablePath,
        headless: true as any,
      });
    } else {
      // On localhost: use puppeteer-extra + stealth plugin
      const puppeteerExtra = (await import("puppeteer-extra")).default;
      const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
      const vanillaPuppeteer = (await import("puppeteer")).default;
      puppeteerExtra.use(StealthPlugin());

      let execPath = await vanillaPuppeteer.executablePath();
      if (!fs.existsSync(execPath)) {
        const fallbacks = [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ];
        const found = fallbacks.find((p) => fs.existsSync(p));
        if (found) execPath = found;
      }

      const launchOptions: any = {
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1280,800",
          "--lang=en-US,en",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-software-rasterizer",
          "--disable-extensions",
        ],
      };
      if (fs.existsSync(execPath)) launchOptions.executablePath = execPath;
      browser = await puppeteerExtra.launch(launchOptions);
    }

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    console.log(`[Puppeteer] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Consent banner
    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.trim() || "";
          return (
            t.includes("Accept all") ||
            t.includes("I agree") ||
            t.includes("Agree") ||
            t.includes("Accept") ||
            t.includes("Consent")
          );
        });
        if (btn) (btn as HTMLButtonElement).click();
      });
      await new Promise((r) => setTimeout(r, 2000));
    } catch {}

    // Wait for place cards
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch {}

    // Scroll to load more
    try {
      await page.evaluate(async (count: number) => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) {
          let attempts = 0;
          while (attempts < 15) {
            feed.scrollTo(0, feed.scrollHeight);
            await new Promise((r) => setTimeout(r, 1200));
            if (document.querySelectorAll('a[href*="/maps/place/"]').length >= count) break;
            attempts++;
          }
        }
      }, targetCount);
    } catch {}

    // Collect listing cards
    const listingsData: Array<{
      name: string;
      href: string;
      rating?: number;
      reviewsCount?: number;
    }> = await page.evaluate(() => {
      const results: any[] = [];
      for (const el of Array.from(document.querySelectorAll('a[href*="/maps/place/"]'))) {
        const card =
          el.closest('div[role="article"]') || el.parentElement?.parentElement;
        if (!card) continue;
        const nameEl = card.querySelector(
          "div.fontHeadlineSmall, span.fontHeadlineSmall, div.qBF1Pd"
        );
        const name =
          nameEl?.textContent?.trim() || el.getAttribute("aria-label") || "";
        const href = el.getAttribute("href");
        if (!name || !href) continue;

        let rating: number | undefined;
        const ratingSpan = card.querySelector("span.MW4etd, span.fontBodyMedium span");
        if (ratingSpan) {
          const s = parseFloat(ratingSpan.textContent || "");
          if (!isNaN(s) && s >= 1 && s <= 5) rating = s;
        }

        let reviewsCount: number | undefined;
        const revSpan = card.querySelector(
          "span.UY7F9, span.fontBodyMedium span:nth-child(2)"
        );
        if (revSpan) {
          const m =
            (revSpan.textContent || "").match(/\(([0-9,]+)\)/) ||
            (revSpan.textContent || "").match(/([0-9,]+)/);
          if (m) reviewsCount = parseInt(m[1].replace(/,/g, ""), 10);
        }
        results.push({ name, href, rating, reviewsCount });
      }
      const unique: any[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        const k = r.name.toLowerCase();
        if (!seen.has(k)) { seen.add(k); unique.push(r); }
      }
      return unique;
    });

    const countToScrape = Math.min(listingsData.length, targetCount);
    console.log(`[Puppeteer] Found ${listingsData.length}, scraping ${countToScrape}`);

    let successCount = 0;
    for (let i = 0; i < countToScrape; i++) {
      const listing = listingsData[i];
      try {
        await page.goto(listing.href, { waitUntil: "domcontentloaded", timeout: 15000 });
        try { await page.waitForSelector("h1", { timeout: 5000 }); } catch {}
        await new Promise((r) => setTimeout(r, 1000));

        // Coordinates from URL
        let lat = 19.076, lng = 72.8777;
        const curUrl = page.url();
        const m1 = curUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (m1) { lat = parseFloat(m1[1]); lng = parseFloat(m1[2]); }
        else {
          const m2 = curUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
          if (m2) { lat = parseFloat(m2[1]); lng = parseFloat(m2[2]); }
        }

        const details = await page.evaluate(() => {
          function cleanUrl(h: string) {
            if (!h) return "";
            try {
              if (h.includes("google.com/url") || h.includes("/url?q=")) {
                const q = new URL(h).searchParams.get("q");
                if (q) return q;
              }
            } catch {}
            return h;
          }

          let website = "";
          const webEl = document.querySelector('a[data-item-id="authority"]');
          if (webEl) {
            website = cleanUrl(webEl.getAttribute("href") || "");
          } else {
            for (const link of Array.from(document.querySelectorAll("a"))) {
              const href = link.getAttribute("href") || "";
              const aria = link.getAttribute("aria-label") || "";
              const txt = link.textContent || "";
              if (
                href.startsWith("http") &&
                (aria.toLowerCase().includes("website") ||
                  txt.toLowerCase().includes("website") ||
                  (!href.includes("google.com") &&
                    !href.includes("google.co.in") &&
                    !href.includes("ggpht.com"))) &&
                !href.includes("facebook.com/sharer") &&
                !href.includes("twitter.com/intent") &&
                !href.includes("maps.google")
              ) {
                website = cleanUrl(href);
                break;
              }
            }
          }

          let phone = "";
          const phoneEl = document.querySelector('[data-item-id^="phone:tel:"]');
          if (phoneEl) {
            phone = (phoneEl.getAttribute("data-item-id") || "").replace("phone:tel:", "").trim();
            if (!phone) phone = phoneEl.textContent?.trim() || "";
          } else {
            const telLink = document.querySelector('a[href^="tel:"]');
            if (telLink) phone = (telLink.getAttribute("href") || "").replace("tel:", "").trim();
            else {
              const btn = document.querySelector('button[aria-label*="Phone"]');
              if (btn) phone = btn.textContent?.trim() || "";
            }
          }
          if (!phone) {
            const container = document.querySelector('div[role="main"]') || document.body;
            const matches = (container.textContent || "").match(
              /(?:\+?\d{1,3}[- ]?)?\(?\d{2,5}\)?[- ]?\d{3,5}[- ]?\d{3,5}/g
            );
            if (matches) {
              const valid = matches.filter((m) => {
                const d = m.replace(/\D/g, "");
                return d.length >= 8 && d.length <= 15;
              });
              if (valid.length) phone = valid[0].trim();
            }
          }
          phone = phone.replace(/phone:tel:/g, "").trim();

          let address = "";
          const addrEl = document.querySelector('button[data-item-id="address"]');
          if (addrEl) address = addrEl.textContent?.trim() || "";

          return { website, phone, address };
        });

        const lead: Lead = {
          id: `live-${String(i + 1).padStart(2, "0")}`,
          name: listing.name,
          category: input.niche,
          address: details.address || input.city,
          city: input.city,
          phone: details.phone || undefined,
          whatsapp: details.phone || undefined,
          website: details.website || undefined,
          lat,
          lng,
          rating: listing.rating || undefined,
          reviewsCount: listing.reviewsCount || undefined,
        };

        sendEvent({ type: "lead", lead });
        saveLeadToAirtable(lead, input.niche).catch(() => {});
        successCount++;
      } catch (err) {
        console.error(`[Puppeteer] Error on ${listing.name}:`, err);
      }
    }

    sendEvent({ type: "done", count: successCount });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Apify scraper ───────────────────────────────────────────────────────────
async function runApifyScrape(
  searchQuery: string,
  input: ScrapeInputExtended,
  targetCount: number,
  sendEvent: (data: any) => void,
): Promise<boolean> {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";

  if (!APIFY_TOKEN) {
    console.log("[Apify] No APIFY_TOKEN, skipping.");
    return false;
  }

  try {
    console.log(`[Apify] Starting actor run for: ${searchQuery}`);
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: targetCount,
          language: "en",
        }),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      throw new Error(`Apify HTTP ${runRes.status}: ${errText.slice(0, 200)}`);
    }

    const items = (await runRes.json()) as Array<Record<string, unknown>>;
    console.log(`[Apify] Got ${items.length} results`);

    if (items.length === 0) {
      sendEvent({ type: "done", count: 0 });
      return true;
    }

    const leadsToReturn = items.slice(0, targetCount);
    for (let i = 0; i < leadsToReturn.length; i++) {
      const it = leadsToReturn[i];
      const lead: Lead = {
        id: `live-${String(i + 1).padStart(2, "0")}`,
        name: String(it.title ?? it.name ?? "Unknown Business"),
        category: String(it.categoryName ?? input.niche),
        address: String(it.address ?? input.city),
        city: input.city,
        phone: it.phone ? String(it.phone) : undefined,
        whatsapp: it.phone ? String(it.phone) : undefined,
        website: it.website ? String(it.website) : undefined,
        rating:
          typeof it.totalScore === "number" ? (it.totalScore as number) : undefined,
        reviewsCount:
          typeof it.reviewsCount === "number"
            ? (it.reviewsCount as number)
            : undefined,
        lat:
          typeof (it.location as { lat?: number })?.lat === "number"
            ? (it.location as { lat: number }).lat
            : 19.06,
        lng:
          typeof (it.location as { lng?: number })?.lng === "number"
            ? (it.location as { lng: number }).lng
            : 72.83,
        photosCount:
          typeof it.imagesCount === "number" ? (it.imagesCount as number) : undefined,
      };
      sendEvent({ type: "lead", lead });
      saveLeadToAirtable(lead, input.niche).catch(() => {});
      await new Promise((r) => setTimeout(r, 80));
    }

    sendEvent({ type: "done", count: leadsToReturn.length });
    return true;
  } catch (e: any) {
    console.error("[Apify] Error:", e.message);
    return false; // Signal failure so caller can fallback
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const input = (await req.json()) as ScrapeInputExtended;
    const searchQuery = `${input.niche} in ${input.city}`;
    const targetCount = Number(input.count) || 10;
    const provider = input.provider || "local";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        try {
          if (provider === "apify") {
            // ── Apify selected → try Apify, if fails fallback to Puppeteer ──
            const success = await runApifyScrape(searchQuery, input, targetCount, sendEvent);
            if (!success) {
              console.log("[Apify] Failed, falling back to Puppeteer...");
              sendEvent({ type: "info", message: "Apify failed, switching to local browser scraper..." });
              await runPuppeteerScrape(searchQuery, input, targetCount, sendEvent);
            }
          } else {
            // ── Local selected → ONLY Puppeteer, never Apify ──
            await runPuppeteerScrape(searchQuery, input, targetCount, sendEvent);
          }
        } catch (e: any) {
          console.error("[/api/scrape] Unhandled error:", e);
          sendEvent({ type: "error", error: e.message || "Scrape failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[/api/scrape] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
