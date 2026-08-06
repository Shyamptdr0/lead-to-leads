import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Lead, AuditResult } from "@/lib/types";
import axios from "axios";
import * as cheerio from "cheerio";
import { scoreLead } from "@/lib/scoring";
import { updateLeadInAirtable } from "@/lib/airtable";

const PSI_KEY = process.env.GOOGLE_PAGESPEED_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

async function loadSeedAudits(): Promise<Record<string, AuditResult>> {
  try {
    const p = path.join(process.cwd(), "data", "leads-seed.json");
    const raw = await fs.readFile(p, "utf-8");
    const json = JSON.parse(raw);
    return (json.audits as Record<string, AuditResult>) || {};
  } catch (e) {
    return {};
  }
}

interface HtmlAuditInfo {
  loadTimeMs: number;
  score: number;
  mobileFriendly: boolean;
  hasSchema: boolean;
  hasViewport: boolean;
  hasMetaDescription: boolean;
  hasOgTags: boolean;
  hasWhatsAppButton: boolean;
  hasBookingSystem: boolean;
  emails: string[];
  instagram?: string;
  phone?: string;
}

// Deep HTML audit of a target website
async function auditWebsiteHtml(url: string): Promise<HtmlAuditInfo> {
  const startTime = Date.now();
  let loadTimeMs = 5000;
  let html = "";
  let isHttps = url.startsWith("https");

  try {
    const formattedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    const response = await axios.get(formattedUrl, {
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });
    loadTimeMs = Date.now() - startTime;
    html = typeof response.data === "string" ? response.data : String(response.data);
  } catch (err: any) {
    console.log(`[Audit Scraper] Could not fetch ${url}: ${err?.message || "Timeout/Connection failed"}`);
    return {
      loadTimeMs: 6500,
      score: 25,
      mobileFriendly: false,
      hasSchema: false,
      hasViewport: false,
      hasMetaDescription: false,
      hasOgTags: false,
      hasWhatsAppButton: false,
      hasBookingSystem: false,
      emails: [],
    };
  }

  const $ = cheerio.load(html);

  // 1. Check Mobile Friendly (Viewport tag + responsive metadata)
  const viewportTag = $('meta[name="viewport"]').attr("content") || "";
  const hasViewport = viewportTag.length > 0 && (viewportTag.includes("width=device-width") || viewportTag.includes("initial-scale"));
  const mobileFriendly = hasViewport;

  // 2. Check Schema.org Structured Data
  let hasSchema = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html() || "";
    if (content.includes("schema.org") || content.includes("@context") || content.includes("@type")) {
      hasSchema = true;
    }
  });
  if (!hasSchema) {
    if ($('[itemscope]').length > 0 || html.includes('itemtype="http://schema.org') || html.includes('itemtype="https://schema.org')) {
      hasSchema = true;
    }
  }

  // 3. Meta Tags
  const hasMetaDescription = ($('meta[name="description"]').attr("content") || "").length > 5;
  const hasOgTags = ($('meta[property^="og:"]').length > 0);

  // 4. Contact Info & Socials
  const foundEmails = new Set<string>();
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const bodyText = $("body").text();
  const matches = bodyText.match(emailRegex);
  if (matches) {
    matches.forEach((m) => {
      const clean = m.toLowerCase();
      if (!clean.endsWith(".png") && !clean.endsWith(".jpg") && !clean.endsWith(".svg") && !clean.includes("example.com") && !clean.includes("wixpress.com")) {
        foundEmails.add(m);
      }
    });
  }

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = href.replace("mailto:", "").split("?")[0].trim();
      if (email) foundEmails.add(email);
    }
  });

  let instagram: string | undefined = undefined;
  let phone: string | undefined = undefined;
  let hasWhatsAppButton = false;
  let hasBookingSystem = false;

  $('a').each((_, el) => {
    const href = $(el).attr("href") || "";
    const lowerHref = href.toLowerCase();
    
    if (lowerHref.includes("instagram.com/")) {
      instagram = href;
    }
    if (lowerHref.startsWith("tel:")) {
      phone = href.replace("tel:", "").trim();
    }
    if (lowerHref.includes("wa.me") || lowerHref.includes("whatsapp.com") || lowerHref.includes("api.whatsapp.com")) {
      hasWhatsAppButton = true;
    }
    if (lowerHref.includes("booking") || lowerHref.includes("calendly") || lowerHref.includes("appointment") || lowerHref.includes("zocdoc") || lowerHref.includes("practo") || lowerHref.includes("book-online")) {
      hasBookingSystem = true;
    }
  });

  if (!hasWhatsAppButton && (html.toLowerCase().includes("whatsapp") || html.toLowerCase().includes("chat with us"))) {
    hasWhatsAppButton = true;
  }
  if (!hasBookingSystem && (html.toLowerCase().includes("book an appointment") || html.toLowerCase().includes("book now") || html.toLowerCase().includes("online booking"))) {
    hasBookingSystem = true;
  }

  // 5. Calculate PageSpeed Score
  let score = 50;
  if (loadTimeMs < 800) score += 25;
  else if (loadTimeMs < 1800) score += 15;
  else if (loadTimeMs < 3000) score += 5;
  else score -= 15;

  if (hasViewport) score += 10;
  if (isHttps) score += 10;
  if (hasSchema) score += 5;
  if (hasMetaDescription) score += 5;

  // Penalty for slow or bulky DOM
  if (html.length > 500000) score -= 10;

  score = Math.max(15, Math.min(98, score));

  return {
    loadTimeMs,
    score,
    mobileFriendly,
    hasSchema,
    hasViewport,
    hasMetaDescription,
    hasOgTags,
    hasWhatsAppButton,
    hasBookingSystem,
    emails: Array.from(foundEmails),
    instagram,
    phone,
  };
}

// Call Google PageSpeed API if API key is provided
async function fetchGooglePageSpeed(url: string): Promise<{ score: number; loadTimeMs: number } | null> {
  if (!PSI_KEY) return null;
  try {
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&key=${PSI_KEY}`;
    const res = await axios.get(psiUrl, { timeout: 10000 });
    const lighthouse = res.data?.lighthouseResult;
    const perfScore = Math.round((lighthouse?.categories?.performance?.score ?? 0.5) * 100);
    const fcp = lighthouse?.audits?.['first-contentful-paint']?.numericValue ?? 2000;
    return { score: perfScore, loadTimeMs: Math.round(fcp) };
  } catch (e) {
    return null;
  }
}

// Generate AI summary for biggest opportunity using OpenRouter
async function generateAIOpportunity(lead: Lead, gaps: string[], score: number, hasWebsite: boolean): Promise<string | null> {
  if (!OPENROUTER_KEY) return null;
  try {
    const prompt = `Analyze this local business lead and provide a punchy 1-2 sentence high-impact growth summary of their biggest missing opportunity and how to fix it:
Business Name: ${lead.name}
Category/Niche: ${lead.category}
City: ${lead.city}
Rating: ${lead.rating || "N/A"} (${lead.reviewsCount || 0} reviews)
Has Website: ${hasWebsite}
PageSpeed Score: ${score}/100
Identified Gaps: ${gaps.join(", ")}

Write a direct, professional, and convincing 1-2 sentence recommendation for an outreach proposal. Focus on revenue impact. Do not use quotes.`;

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 6000,
      }
    );

    const summary = res.data?.choices?.[0]?.message?.content?.trim();
    return summary || null;
  } catch (e) {
    return null;
  }
}

export async function POST(req: Request) {
  const { lead } = (await req.json()) as { lead: Lead };

  const hasWebsite = !!lead.website;

  // Check seed fallback first
  const seed = await loadSeedAudits();
  if (seed[lead.id]) {
    let email = lead.email;
    let instagram = lead.instagram;
    let phone = lead.phone;

    if (hasWebsite) {
      const htmlAudit = await auditWebsiteHtml(lead.website!);
      if (htmlAudit.emails.length > 0) email = htmlAudit.emails[0];
      if (htmlAudit.instagram) instagram = htmlAudit.instagram;
      if (htmlAudit.phone) phone = htmlAudit.phone;
    }

    const audit = seed[lead.id];

    // Calculate rank and sync to Airtable in background
    const rankedLead = scoreLead(lead, audit);
    updateLeadInAirtable(
      lead,
      audit,
      rankedLead.score,
      lead.category,
      { email, phone, instagram }
    ).catch(() => {});

    return NextResponse.json({
      audit,
      email,
      instagram,
      phone,
    });
  }

  // Execute full deep audit
  let score = 30;
  let loadTimeMs = 0;
  let mobileFriendly = false;
  let hasSchema = false;
  let isHttps = false;
  let emails: string[] = [];
  let instagram: string | undefined = undefined;
  let phone: string | undefined = undefined;
  let hasWhatsAppButton = false;
  let hasBookingSystem = false;
  let hasMetaDescription = false;

  if (hasWebsite) {
    isHttps = lead.website!.startsWith("https");
    const htmlAudit = await auditWebsiteHtml(lead.website!);

    score = htmlAudit.score;
    loadTimeMs = htmlAudit.loadTimeMs;
    mobileFriendly = htmlAudit.mobileFriendly;
    hasSchema = htmlAudit.hasSchema;
    emails = htmlAudit.emails;
    instagram = htmlAudit.instagram;
    phone = htmlAudit.phone;
    hasWhatsAppButton = htmlAudit.hasWhatsAppButton;
    hasBookingSystem = htmlAudit.hasBookingSystem;
    hasMetaDescription = htmlAudit.hasMetaDescription;

    // Try Google PageSpeed Insights if available
    const psiResult = await fetchGooglePageSpeed(lead.website!);
    if (psiResult) {
      score = psiResult.score;
      loadTimeMs = psiResult.loadTimeMs;
    }
  }

  // Compile Comprehensive Gaps List
  const gaps: string[] = [];
  if (!hasWebsite) {
    gaps.push("No Website (Zero Search Visibility)");
  } else {
    if (!isHttps) gaps.push("Non-HTTPS (Insecure Connection)");
    if (score < 60) gaps.push(`Slow PageSpeed (${score}/100)`);
    if (loadTimeMs > 3000) gaps.push(`High Load Latency (${(loadTimeMs / 1000).toFixed(1)}s)`);
    if (!mobileFriendly) gaps.push("Not Mobile Optimized (Missing Viewport Meta)");
    if (!hasSchema) gaps.push("Missing Schema.org Structured Data");
    if (!hasMetaDescription) gaps.push("Missing Meta SEO Description");
    if (!hasBookingSystem) gaps.push("No Instant Online Booking System");
    if (!hasWhatsAppButton) gaps.push("No Instant WhatsApp Lead Capture");
  }

  if (!lead.whatsapp && !hasWhatsAppButton) gaps.push("No WhatsApp Direct Chat");

  // Calculate Estimated Monthly Lost Revenue
  const reviewCount = lead.reviewsCount ?? 20;
  const rating = lead.rating ?? 4.0;
  const baseNicheMultiplier = lead.category.toLowerCase().includes("dent") || lead.category.toLowerCase().includes("clinic") ? 600 : 450;
  
  let estLostRevenuePerMonth = reviewCount * baseNicheMultiplier;
  if (!hasWebsite) {
    estLostRevenuePerMonth += 45000;
  } else {
    if (score < 50) estLostRevenuePerMonth += 18000;
    if (!hasBookingSystem) estLostRevenuePerMonth += 22000;
    if (!hasWhatsAppButton) estLostRevenuePerMonth += 15000;
    if (!mobileFriendly) estLostRevenuePerMonth += 20000;
  }
  // Round to clean thousands
  estLostRevenuePerMonth = Math.round(estLostRevenuePerMonth / 1000) * 1000;

  // Generate AI Biggest Opportunity Summary
  const aiSummary = await generateAIOpportunity(lead, gaps, score, hasWebsite);

  const fallbackBiggestGap = !hasWebsite
    ? `${reviewCount} Google reviews, but ZERO web presence. Potential clients looking on Google search land on competitors with online booking.`
    : score < 50 || loadTimeMs > 3500
    ? `Site takes ${(loadTimeMs / 1000).toFixed(1)}s to load (${score}/100 PageSpeed). Upgrading to Next.js + Tailwind converts bouncing visitors into paid appointments.`
    : !hasBookingSystem || !hasWhatsAppButton
    ? `Lacks 1-click WhatsApp or online booking. Adding modern lead widgets can instantly lift website lead conversion by 30-40%.`
    : `Missing Schema.org structured data and rich snippets. Adding local business schema will improve Google Maps & search rankings.`;

  const biggestGap = aiSummary || fallbackBiggestGap;

  const audit: AuditResult = {
    leadId: lead.id,
    pageSpeedScore: hasWebsite ? score : 0,
    hasWebsite,
    mobileFriendly: hasWebsite ? mobileFriendly : false,
    https: isHttps,
    hasSchema,
    loadTimeMs,
    gaps,
    biggestGap,
    estLostRevenuePerMonth,
  };

  const finalEmail = emails.length > 0 ? emails[0] : lead.email;
  const finalInstagram = instagram || lead.instagram;
  const finalPhone = phone || lead.phone;

  // Calculate rank and sync to Airtable in background
  const rankedLead = scoreLead(lead, audit);
  updateLeadInAirtable(
    lead,
    audit,
    rankedLead.score,
    lead.category,
    { email: finalEmail, phone: finalPhone, instagram: finalInstagram }
  ).catch(() => {});

  return NextResponse.json({
    audit,
    email: finalEmail,
    instagram: finalInstagram,
    phone: finalPhone,
  });
}
