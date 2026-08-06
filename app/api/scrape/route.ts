import { NextResponse } from "next/server";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import vanillaPuppeteer from 'puppeteer';
import fs from 'fs';
import type { Lead, ScrapeInput } from "@/lib/types";
import { saveLeadToAirtable } from "@/lib/airtable";

puppeteer.use(StealthPlugin());

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";

interface ScrapeInputExtended extends ScrapeInput {
  provider?: 'local' | 'apify';
}

export async function POST(req: Request) {
  const input = (await req.json()) as ScrapeInputExtended;
  const searchQuery = `${input.niche} in ${input.city}`;
  const provider = input.provider || 'local';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might be closed
        }
      };

      if (provider === 'apify') {
        if (!APIFY_TOKEN) {
          sendEvent({ type: 'error', error: "APIFY_TOKEN missing in .env" });
          controller.close();
          return;
        }
        try {
          console.log(`Running explicit Apify request for: ${searchQuery}`);
          const runRes = await fetch(
            `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                searchStringsArray: [searchQuery],
                maxCrawledPlacesPerSearch: input.count,
                language: "en",
              }),
            },
          );
          if (!runRes.ok) throw new Error(`Apify API failed with status ${runRes.status}`);
          const items = (await runRes.json()) as Array<Record<string, unknown>>;
          
          const leadsToReturn = items.slice(0, input.count);
          for (let i = 0; i < leadsToReturn.length; i++) {
            const it = leadsToReturn[i];
            const lead: Lead = {
              id: `live-${String(i + 1).padStart(2, "0")}`,
              name: String(it.title ?? it.name ?? "Unknown Business"),
              category: String(it.categoryName ?? input.niche),
              address: String(it.address ?? ""),
              city: input.city,
              phone: it.phone ? String(it.phone) : undefined,
              whatsapp: it.phone ? String(it.phone) : undefined,
              website: it.website ? String(it.website) : undefined,
              rating: typeof it.totalScore === "number" ? (it.totalScore as number) : undefined,
              reviewsCount: typeof it.reviewsCount === "number" ? (it.reviewsCount as number) : undefined,
              lat: typeof (it.location as { lat?: number })?.lat === "number" ? (it.location as { lat: number }).lat : 19.06,
              lng: typeof (it.location as { lng?: number })?.lng === "number" ? (it.location as { lng: number }).lng : 72.83,
              photosCount: typeof it.imagesCount === "number" ? (it.imagesCount as number) : undefined,
            };
            sendEvent({ type: 'lead', lead });
            // Save to Airtable in background (fire-and-forget, won't block stream)
            saveLeadToAirtable(lead, input.niche).catch(() => {});
            await new Promise(r => setTimeout(r, 80)); // slightly stagger for UI
          }
          sendEvent({ type: 'done', count: leadsToReturn.length });
        } catch (e: any) {
          sendEvent({ type: 'error', error: e.message });
        } finally {
          controller.close();
        }
        return;
      }

      // LOCAL SCRAPER ROUTE
      let browser;
      try {
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

        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
        });

        const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle Consent
        try {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const acceptBtn = buttons.find(b => {
              const text = b.textContent?.trim() || '';
              return text.includes('Accept all') || text.includes('I agree') || text.includes('Agree') || text.includes('Accept') || text.includes('Consent');
            });
            if (acceptBtn) {
              (acceptBtn as HTMLButtonElement).click();
            }
          });
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) { }

        // Wait for results
        try {
          await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
        } catch (e) { }

        // Scroll dynamically
        try {
          await page.evaluate(async (count) => {
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
          }, input.count);
        } catch (scrollErr) { }

        // 1. Collect all basic listing info
        const listingsData = await page.evaluate(() => {
          const results: any[] = [];
          const anchors = document.querySelectorAll('a[href*="/maps/place/"]');
          
          for (const el of Array.from(anchors)) {
            const card = el.closest('div[role="article"]') || el.parentElement?.parentElement;
            if (!card) continue;

            const nameEl = card.querySelector('div.fontHeadlineSmall, span.fontHeadlineSmall, div.qBF1Pd');
            const name = nameEl?.textContent?.trim() || el.getAttribute('aria-label') || "";
            const href = el.getAttribute('href');

            if (!name || !href) continue;

            let rating: number | undefined = undefined;
            const ratingSpan = card.querySelector('span.MW4etd, span.fontBodyMedium span');
            if (ratingSpan) {
              const score = parseFloat(ratingSpan.textContent || "");
              if (!isNaN(score) && score >= 1 && score <= 5) rating = score;
            }

            let reviewsCount: number | undefined = undefined;
            const reviewsSpan = card.querySelector('span.UY7F9, span.fontBodyMedium span:nth-child(2)');
            if (reviewsSpan) {
              const countMatch = (reviewsSpan.textContent || "").match(/\(([0-9,]+)\)/) || (reviewsSpan.textContent || "").match(/([0-9,]+)/);
              if (countMatch) reviewsCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
            }

            results.push({ name, href, rating, reviewsCount });
          }
          
          const uniqueResults = [];
          const seen = new Set();
          for (const res of results) {
            const cleanName = res.name.toLowerCase();
            if (!seen.has(cleanName)) {
              seen.add(cleanName);
              uniqueResults.push(res);
            }
          }
          return uniqueResults;
        });

        const countToScrape = Math.min(listingsData.length, input.count);
        console.log(`[Scraper] Found ${listingsData.length} unique listings, scraping details for up to ${countToScrape}`);

        // 2. Visit each listing's URL directly to extract details and coordinates
        let successfulLeads = 0;
        for (let i = 0; i < countToScrape; i++) {
          const listing = listingsData[i];
          try {
            console.log(`[Scraper] [${i + 1}/${countToScrape}] Navigating to detail page for: "${listing.name}"`);
            await page.goto(listing.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            try {
              await page.waitForSelector('h1', { timeout: 5000 });
            } catch (e) { }
            await new Promise(r => setTimeout(r, 1000)); 

            // Extract lat/lng from URL
            let lat = 19.0760;
            let lng = 72.8777;
            const currentUrl = page.url();
            const coordsMatch1 = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordsMatch1) {
              lat = parseFloat(coordsMatch1[1]);
              lng = parseFloat(coordsMatch1[2]);
            } else {
              const coordsMatch2 = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
              if (coordsMatch2) {
                lat = parseFloat(coordsMatch2[1]);
                lng = parseFloat(coordsMatch2[2]);
              }
            }

            const details = await page.evaluate(() => {
              function cleanUrl(href: string): string {
                if (!href) return "";
                try {
                  if (href.includes('google.com/url') || href.includes('google.co.in/url') || href.includes('/url?q=')) {
                    const urlObj = new URL(href);
                    const q = urlObj.searchParams.get('q');
                    if (q) return q;
                  }
                } catch (e) { }
                return href;
              }

              let website = "";
              const webEl = document.querySelector('a[data-item-id="authority"]');
              if (webEl) {
                website = cleanUrl(webEl.getAttribute('href') || "");
              } else {
                const allLinks = Array.from(document.querySelectorAll('a'));
                for (const link of allLinks) {
                  const href = link.getAttribute('href');
                  const ariaLabel = link.getAttribute('aria-label') || "";
                  const labelText = link.textContent || "";
                  if (href && href.startsWith('http') && 
                      (ariaLabel.toLowerCase().includes('website') || labelText.toLowerCase().includes('website') ||
                       (!href.includes('google.com') && !href.includes('google.co.in') && !href.includes('ggpht.com')))) {
                    if (!href.includes('facebook.com/sharer') && !href.includes('twitter.com/intent') && !href.includes('maps.google')) {
                      website = cleanUrl(href);
                      break;
                    }
                  }
                }
              }

              let phone = "";
              const phoneEl = document.querySelector('[data-item-id^="phone:tel:"]');
              if (phoneEl) {
                const itemId = phoneEl.getAttribute('data-item-id') || "";
                phone = itemId.replace('phone:tel:', '').trim();
                if (!phone || phone.includes('phone:tel:')) phone = phoneEl.textContent?.trim() || "";
              } else {
                const telLink = document.querySelector('a[href^="tel:"]');
                if (telLink) {
                  phone = telLink.getAttribute('href')?.replace('tel:', '').trim() || "";
                } else {
                  const phoneButton = document.querySelector('button[aria-label*="Phone"], button[data-tooltip*="phone"]');
                  if (phoneButton) phone = phoneButton.textContent?.trim() || "";
                }
              }

              if (!phone) {
                const container = document.querySelector('div[role="main"]') || document.body;
                const matches = (container.textContent || "").match(/(?:\+?\d{1,3}[- ]?)?\(?\d{2,5}\)?[- ]?\d{3,5}[- ]?\d{3,5}/g);
                if (matches) {
                  const validPhones = matches.filter(m => {
                    const digits = m.replace(/\D/g, '');
                    return digits.length >= 8 && digits.length <= 15;
                  });
                  if (validPhones.length > 0) phone = validPhones[0].trim();
                }
              }
              if (phone) phone = phone.replace(/phone:tel:/g, '').trim();

              let address = "";
              const addressEl = document.querySelector('button[data-item-id="address"]');
              if (addressEl) address = addressEl.textContent?.trim() || "";

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
            // Save to Airtable in background (fire-and-forget, won't block stream)
            saveLeadToAirtable(lead, input.niche).catch(() => {});
            successfulLeads++;

          } catch (err) {
            console.error(`[Scraper] Error scraping details for ${listing.name}:`, err);
          }
        }
        sendEvent({ type: 'done', count: successfulLeads });
      } catch (e: any) {
        console.error("Puppeteer Maps Scrape Error:", e);
        sendEvent({ type: 'error', error: e.message });
      } finally {
        if (browser) await browser.close();
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
}
