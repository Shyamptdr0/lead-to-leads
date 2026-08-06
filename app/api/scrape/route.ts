import { NextResponse } from "next/server";
import fs from 'fs';
import type { Lead, ScrapeInput } from "@/lib/types";
import { saveLeadToAirtable } from "@/lib/airtable";

interface ScrapeInputExtended extends ScrapeInput {
  provider?: 'local' | 'apify';
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as ScrapeInputExtended;
    const searchQuery = `${input.niche} in ${input.city}`;
    const targetCount = Number(input.count) || 10;
    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";
    const isVercel = !!process.env.VERCEL;

    // On Vercel, only Apify is supported (no local Chrome)
    // Locally, both are supported
    let effectiveProvider = input.provider || 'local';
    if (isVercel && effectiveProvider === 'local') {
      effectiveProvider = 'apify';
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            // Stream closed
          }
        };

        // ─── APIFY CLOUD PATH ────────────────────────────────────────────────
        if (effectiveProvider === 'apify') {
          if (!APIFY_TOKEN) {
            sendEvent({
              type: 'error',
              error: "APIFY_TOKEN is not set. Go to Vercel → Project Settings → Environment Variables and add your APIFY_TOKEN, then redeploy."
            });
            controller.close();
            return;
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
              },
            );

            if (!runRes.ok) {
              const errText = await runRes.text();
              throw new Error(`Apify API returned HTTP ${runRes.status}: ${errText.slice(0, 200)}`);
            }

            const items = (await runRes.json()) as Array<Record<string, unknown>>;
            console.log(`[Apify] Got ${items.length} results from actor`);

            if (items.length === 0) {
              sendEvent({ type: 'done', count: 0 });
              controller.close();
              return;
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
                rating: typeof it.totalScore === "number" ? (it.totalScore as number) : undefined,
                reviewsCount: typeof it.reviewsCount === "number" ? (it.reviewsCount as number) : undefined,
                lat: typeof (it.location as { lat?: number })?.lat === "number"
                  ? (it.location as { lat: number }).lat
                  : 19.06,
                lng: typeof (it.location as { lng?: number })?.lng === "number"
                  ? (it.location as { lng: number }).lng
                  : 72.83,
                photosCount: typeof it.imagesCount === "number" ? (it.imagesCount as number) : undefined,
              };
              sendEvent({ type: 'lead', lead });
              saveLeadToAirtable(lead, input.niche).catch(() => {});
              await new Promise(r => setTimeout(r, 80));
            }

            sendEvent({ type: 'done', count: leadsToReturn.length });
          } catch (e: any) {
            console.error("[Apify] Error:", e);
            sendEvent({ type: 'error', error: e.message || "Apify cloud scraper failed" });
          } finally {
            controller.close();
          }
          return;
        }

        // ─── LOCAL PUPPETEER PATH ─────────────────────────────────────────────
        let browser: any;
        try {
          const puppeteerExtra = (await import('puppeteer-extra')).default;
          const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
          const vanillaPuppeteer = (await import('puppeteer')).default;
          puppeteerExtra.use(StealthPlugin());

          let execPath = await vanillaPuppeteer.executablePath();
          if (!fs.existsSync(execPath)) {
            const fallbackPaths = [
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
              'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
              'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
              'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            ];
            const found = fallbackPaths.find(p => fs.existsSync(p));
            if (found) execPath = found;
          }

          const launchOptions: any = {
            headless: true,
            defaultViewport: { width: 1280, height: 800 },
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-blink-features=AutomationControlled',
              '--window-size=1280,800',
              '--lang=en-US,en',
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--disable-software-rasterizer',
              '--disable-extensions',
            ]
          };

          if (fs.existsSync(execPath)) {
            launchOptions.executablePath = execPath;
          }

          browser = await puppeteerExtra.launch(launchOptions);
          const page = await browser.newPage();
          await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

          const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
          console.log(`[Local] Navigating to: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Handle consent banner
          try {
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const acceptBtn = buttons.find(b => {
                const text = b.textContent?.trim() || '';
                return text.includes('Accept all') || text.includes('I agree') || text.includes('Agree') || text.includes('Accept') || text.includes('Consent');
              });
              if (acceptBtn) (acceptBtn as HTMLButtonElement).click();
            });
            await new Promise(r => setTimeout(r, 2000));
          } catch (err) { }

          // Wait for place cards
          try {
            await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
          } catch (e) { }

          // Scroll to load more results
          try {
            await page.evaluate(async (count: number) => {
              const feed = document.querySelector('div[role="feed"]');
              if (feed) {
                let attempts = 0;
                while (attempts < 15) {
                  feed.scrollTo(0, feed.scrollHeight);
                  await new Promise(r => setTimeout(r, 1200));
                  const itemsCount = document.querySelectorAll('a[href*="/maps/place/"]').length;
                  if (itemsCount >= count) break;
                  attempts++;
                }
              }
            }, targetCount);
          } catch (scrollErr) { }

          // Collect listing links
          const listingsData: Array<{ name: string; href: string; rating?: number; reviewsCount?: number }> = await page.evaluate(() => {
            const results: any[] = [];
            const anchors = document.querySelectorAll('a[href*="/maps/place/"]');

            for (const el of Array.from(anchors)) {
              const card = el.closest('div[role="article"]') || el.parentElement?.parentElement;
              if (!card) continue;

              const nameEl = card.querySelector('div.fontHeadlineSmall, span.fontHeadlineSmall, div.qBF1Pd');
              const name = nameEl?.textContent?.trim() || el.getAttribute('aria-label') || "";
              const href = el.getAttribute('href');
              if (!name || !href) continue;

              let rating: number | undefined;
              const ratingSpan = card.querySelector('span.MW4etd, span.fontBodyMedium span');
              if (ratingSpan) {
                const score = parseFloat(ratingSpan.textContent || "");
                if (!isNaN(score) && score >= 1 && score <= 5) rating = score;
              }

              let reviewsCount: number | undefined;
              const reviewsSpan = card.querySelector('span.UY7F9, span.fontBodyMedium span:nth-child(2)');
              if (reviewsSpan) {
                const m = (reviewsSpan.textContent || "").match(/\(([0-9,]+)\)/) || (reviewsSpan.textContent || "").match(/([0-9,]+)/);
                if (m) reviewsCount = parseInt(m[1].replace(/,/g, ''), 10);
              }

              results.push({ name, href, rating, reviewsCount });
            }

            const uniqueResults: any[] = [];
            const seen = new Set<string>();
            for (const res of results) {
              const key = res.name.toLowerCase();
              if (!seen.has(key)) { seen.add(key); uniqueResults.push(res); }
            }
            return uniqueResults;
          });

          const countToScrape = Math.min(listingsData.length, targetCount);
          console.log(`[Local] Found ${listingsData.length} listings, scraping ${countToScrape} in detail`);

          let successfulLeads = 0;
          for (let i = 0; i < countToScrape; i++) {
            const listing = listingsData[i];
            try {
              console.log(`[Local] [${i + 1}/${countToScrape}] Scraping: ${listing.name}`);
              await page.goto(listing.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
              try { await page.waitForSelector('h1', { timeout: 5000 }); } catch (e) { }
              await new Promise(r => setTimeout(r, 1000));

              // Extract coordinates from URL
              let lat = 19.0760, lng = 72.8777;
              const currentUrl = page.url();
              const m1 = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (m1) { lat = parseFloat(m1[1]); lng = parseFloat(m1[2]); }
              else {
                const m2 = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
                if (m2) { lat = parseFloat(m2[1]); lng = parseFloat(m2[2]); }
              }

              const details = await page.evaluate(() => {
                function cleanUrl(href: string) {
                  if (!href) return "";
                  try {
                    if (href.includes('google.com/url') || href.includes('/url?q=')) {
                      const q = new URL(href).searchParams.get('q');
                      if (q) return q;
                    }
                  } catch { }
                  return href;
                }

                let website = "";
                const webEl = document.querySelector('a[data-item-id="authority"]');
                if (webEl) {
                  website = cleanUrl(webEl.getAttribute('href') || "");
                } else {
                  for (const link of Array.from(document.querySelectorAll('a'))) {
                    const href = link.getAttribute('href') || "";
                    const aria = link.getAttribute('aria-label') || "";
                    const txt = link.textContent || "";
                    if (href.startsWith('http') &&
                      (aria.toLowerCase().includes('website') || txt.toLowerCase().includes('website') ||
                       (!href.includes('google.com') && !href.includes('google.co.in') && !href.includes('ggpht.com'))) &&
                      !href.includes('facebook.com/sharer') && !href.includes('twitter.com/intent') && !href.includes('maps.google')) {
                      website = cleanUrl(href);
                      break;
                    }
                  }
                }

                let phone = "";
                const phoneEl = document.querySelector('[data-item-id^="phone:tel:"]');
                if (phoneEl) {
                  phone = (phoneEl.getAttribute('data-item-id') || "").replace('phone:tel:', '').trim();
                  if (!phone) phone = phoneEl.textContent?.trim() || "";
                } else {
                  const telLink = document.querySelector('a[href^="tel:"]');
                  if (telLink) phone = (telLink.getAttribute('href') || "").replace('tel:', '').trim();
                  else {
                    const btn = document.querySelector('button[aria-label*="Phone"]');
                    if (btn) phone = btn.textContent?.trim() || "";
                  }
                }
                if (!phone) {
                  const container = document.querySelector('div[role="main"]') || document.body;
                  const matches = (container.textContent || "").match(/(?:\+?\d{1,3}[- ]?)?\(?\d{2,5}\)?[- ]?\d{3,5}[- ]?\d{3,5}/g);
                  if (matches) {
                    const valid = matches.filter(m => { const d = m.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15; });
                    if (valid.length) phone = valid[0].trim();
                  }
                }
                phone = phone.replace(/phone:tel:/g, '').trim();

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

              sendEvent({ type: 'lead', lead });
              saveLeadToAirtable(lead, input.niche).catch(() => {});
              successfulLeads++;
            } catch (err) {
              console.error(`[Local] Error on ${listing.name}:`, err);
            }
          }

          sendEvent({ type: 'done', count: successfulLeads });
        } catch (e: any) {
          console.error("[Local] Puppeteer fatal error:", e);
          sendEvent({ type: 'error', error: e.message || "Local browser scrape failed" });
        } finally {
          if (browser) await browser.close().catch(() => {});
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error("[/api/scrape] Fatal handler error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
