import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'path';

puppeteer.use(StealthPlugin());

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";

export async function POST(request: Request) {
  try {
    const { query, location, provider } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const searchQuery = `${query} in ${location || ''}`.trim();
    console.log(`Starting extraction for: ${searchQuery} via ${provider || 'local'}`);

    let searchResults: { title: string, url: string, phone?: string }[] = [];

    // APIFY DISCOVERY MODE (Explicit trigger)
    if (provider === 'apify') {
      if (!APIFY_TOKEN) {
        return NextResponse.json({ error: 'APIFY_TOKEN missing in .env' }, { status: 400 });
      }
      try {
        console.log(`Running Apify discovery request for: ${searchQuery}`);
        const runRes = await fetch(
          `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              searchStringsArray: [searchQuery],
              maxCrawledPlacesPerSearch: 10,
              language: "en",
            }),
          },
        );
        if (!runRes.ok) throw new Error(`Apify API failed with status ${runRes.status}`);
        const items = (await runRes.json()) as Array<Record<string, unknown>>;
        
        searchResults = items.map((it) => ({
          title: String(it.title ?? it.name ?? "Unknown Business"),
          url: String(it.website ?? ""),
          phone: it.phone ? String(it.phone) : undefined,
        })).filter(item => item.url && item.url.startsWith('http'));
      } catch (e: any) {
        console.error("Apify extraction discovery failed:", e);
        return NextResponse.json({ success: false, error: `Apify error: ${e.message}` }, { status: 500 });
      }
    } else {
      // LOCAL PUPPETEER DISCOVERY MODE (Default)
      const browser = await puppeteer.launch({
        headless: 'shell', // Use headless shell to ensure absolutely no window is drawn on Windows
        defaultViewport: { width: 1280, height: 800 },
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,800',
          '--lang=en-US,en',
          '--disable-gpu', 
          '--disable-dev-shm-usage'
        ]
      });

      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });
      
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

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
      } catch (err) {
        console.log("Consent check complete.");
      }

      try {
        await page.screenshot({ path: path.join(process.cwd(), 'public', 'debug-extract.png') });
      } catch (screenshotErr) {
        console.log("Failed to write debug screenshot:", screenshotErr);
      }

      try {
        await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
      } catch (e) {
        console.log("Google Maps elements not found.");
      }

      try {
        await page.evaluate(async (count) => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) {
            let attempts = 0;
            while (attempts < 15) {
              feed.scrollTo(0, feed.scrollHeight);
              await new Promise(r => setTimeout(r, 1200));
              const itemsCount = document.querySelectorAll('a[href*="/maps/place/"]').length;
              if (itemsCount >= count) {
                break;
              }
              attempts++;
            }
          }
        }, 10);
      } catch (scrollErr) {
        console.log("Scroll error:", scrollErr);
      }

      searchResults = await page.evaluate(() => {
        const results: { title: string, url: string, phone?: string }[] = [];
        const placeAnchors = document.querySelectorAll('a[href*="/maps/place/"]');
        
        placeAnchors.forEach((anchor) => {
          const card = anchor.closest('div[role="article"]') || anchor.parentElement?.parentElement;
          if (!card) return;

          const nameEl = card.querySelector('div.fontHeadlineSmall, span.fontHeadlineSmall, div.qBF1Pd');
          const name = nameEl?.textContent?.trim() || anchor.getAttribute('aria-label') || "";

          if (!name) return;

          let website: string | undefined = undefined;
          const anchorsInCard = card.querySelectorAll('a');
          for (const a of Array.from(anchorsInCard)) {
            const href = a.getAttribute('href');
            if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('google.co.in') && !href.includes('ggpht.com')) {
              website = href;
              break;
            }
          }

          let phone: string | undefined = undefined;
          const textContent = card.textContent || "";
          const phoneRegex = /(?:\+?\d{1,3}[- ]?)?\(?\d{2,5}\)?[- ]?\d{3,4}[- ]?\d{3,4}/g;
          const matches = textContent.match(phoneRegex);
          if (matches) {
            const validPhones = matches.filter(m => m.replace(/[-+() ]/g, '').length >= 8);
            if (validPhones.length > 0) {
              phone = validPhones[0].trim();
            }
          }

          if (website) {
            results.push({ title: name, url: website, phone });
          }
        });
        
        const unique = [];
        const seen = new Set();
        for (const item of results) {
          const key = item.title.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        return unique;
      });
      
      await browser.close();
    }
    console.log(`Found ${searchResults.length} initial Google Maps listings with websites.`);

    // PHASE 2 & 3: Deep Crawl website for contacts and check PageSpeed
    const finalLeads = [];
    const maxLeads = 5;

    for (let i = 0; i < Math.min(searchResults.length, maxLeads); i++) {
      const lead = searchResults[i];
      console.log(`Scraping website: ${lead.url}`);
      
      const enrichedData = {
        title: lead.title,
        url: lead.url,
        phone: lead.phone || '',
        emails: [] as string[],
        socials: {
          facebook: '',
          instagram: '',
          linkedin: '',
          twitter: ''
        },
        seoScore: null as number | null,
        pageSpeedScore: null as number | null
      };

      try {
        const response = await axios.get(lead.url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
        const html = response.data;
        const $ = cheerio.load(html);
        
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const bodyText = $('body').text();
        const foundEmails = new Set(bodyText.match(emailRegex));
        
        $('a[href^="mailto:"]').each((_, el) => {
           const href = $(el).attr('href');
           if (href) foundEmails.add(href.replace('mailto:', '').split('?')[0]);
        });

        enrichedData.emails = Array.from(foundEmails).filter(e => !e?.toString().endsWith('.png') && !e?.toString().endsWith('.jpg') && !e?.toString().endsWith('.webp') && !e?.toString().endsWith('.gif')) as string[];

        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const lowerHref = href.toLowerCase();
            if (lowerHref.includes('facebook.com') && !enrichedData.socials.facebook) enrichedData.socials.facebook = href;
            if (lowerHref.includes('instagram.com') && !enrichedData.socials.instagram) enrichedData.socials.instagram = href;
            if (lowerHref.includes('linkedin.com') && !enrichedData.socials.linkedin) enrichedData.socials.linkedin = href;
            if (lowerHref.includes('twitter.com') && !enrichedData.socials.twitter) enrichedData.socials.twitter = href;
          }
        });

      } catch (err) {
        console.log(`Failed to scrape HTML for ${lead.url}`);
      }

      // PageSpeed API
      const pageSpeedKey = process.env.GOOGLE_PAGESPEED_KEY;
      if (pageSpeedKey && pageSpeedKey.length > 10) {
        try {
          const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(lead.url)}&key=${pageSpeedKey}&category=SEO&category=PERFORMANCE`;
          const psiResponse = await axios.get(psiUrl);
          
          const lighthouse = psiResponse.data.lighthouseResult;
          if (lighthouse?.categories) {
            enrichedData.seoScore = lighthouse.categories.seo?.score * 100;
            enrichedData.pageSpeedScore = lighthouse.categories.performance?.score * 100;
          }
        } catch (err) {
          console.log(`Failed to fetch PageSpeed for ${lead.url}`);
        }
      }

      finalLeads.push(enrichedData);
    }

    return NextResponse.json({ success: true, data: finalLeads });
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
