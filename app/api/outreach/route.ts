import { NextResponse } from "next/server";
import type { RankedLead } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────
   INTELLIGENT MESSAGE GENERATION ENGINE
   No external API needed. Deeply analyses audit data & generates
   hyper-personalised outreach using rule-based intelligence.
   ───────────────────────────────────────────────────────────────── */

function analyse(lead: RankedLead) {
  const audit = lead.audit;
  const rating = lead.rating ?? 0;
  const reviews = lead.reviewsCount ?? 0;
  const score = lead.score ?? 0;

  // --- Problem Classification ---
  const problems: { label: string; severity: "critical" | "major" | "minor"; why: string; fix: string }[] = [];

  if (!audit.hasWebsite) {
    problems.push({
      label: "No Website",
      severity: "critical",
      why: "When potential customers search on Google, they find your competitors with websites instead of you. You are invisible online.",
      fix: "A fast, mobile-friendly website with WhatsApp booking integration that captures every search lead 24/7.",
    });
  } else {
    if (audit.pageSpeedScore < 50) {
      problems.push({
        label: `Critically Slow Website (${audit.pageSpeedScore}/100 speed score)`,
        severity: "critical",
        why: "Google research shows 53% of mobile users leave a page that takes longer than 3 seconds to load. Your visitors are bouncing before they even see your services.",
        fix: "A blazing-fast Next.js website that scores 90+ on Google PageSpeed, so you stop losing visitors to slow load times.",
      });
    } else if (audit.pageSpeedScore < 75) {
      problems.push({
        label: `Below-Average Website Speed (${audit.pageSpeedScore}/100)`,
        severity: "major",
        why: "Your site is slower than competitors ranking above you. Google also uses speed as a ranking factor, so this is hurting your search visibility too.",
        fix: "A performance-optimised website that leapfrogs your local competition in Google rankings.",
      });
    }

    if (!audit.mobileFriendly) {
      problems.push({
        label: "Not Mobile-Friendly",
        severity: "critical",
        why: "Over 78% of local service searches happen on mobile. If your site looks broken on a phone, those customers immediately call your competitor.",
        fix: "A fully responsive, mobile-first design that looks flawless on every screen size.",
      });
    }

    if (!audit.https) {
      problems.push({
        label: "No HTTPS Security",
        severity: "major",
        why: "Chrome shows a 'Not Secure' warning on your site. Customers see this and instantly distrust your business with their contact information.",
        fix: "Full SSL security setup, so customers trust your site and convert.",
      });
    }

    if (!audit.hasSchema) {
      problems.push({
        label: "Missing Google Structured Data (Schema)",
        severity: "major",
        why: "Without Schema markup, Google cannot show your star ratings, hours, and services in search results. You are missing the rich snippets that make people click.",
        fix: "LocalBusiness Schema implementation so your listing stands out with rich snippets in search.",
      });
    }
  }

  // Rating & review analysis
  const hasGoodRating = rating >= 4.0;
  const isHighVolume = reviews > 50;
  const estLoss = audit.estLostRevenuePerMonth;

  // Pick top 2 most critical problems for the message
  const topProblems = problems.slice(0, 2);
  const mainProblem = problems[0] || {
    label: audit.biggestGap,
    severity: "major" as const,
    why: "This is directly impacting how many new customers find and trust your business online.",
    fix: "A modern, conversion-optimised web presence that turns searches into bookings.",
  };

  return { problems, topProblems, mainProblem, hasGoodRating, isHighVolume, estLoss, rating, reviews, score };
}

function buildWhatsappHinglish(lead: RankedLead): { first: string; followUp: string } {
  const { mainProblem, topProblems, hasGoodRating, isHighVolume, estLoss, rating, reviews } = analyse(lead);
  const name = lead.name;
  const city = lead.city || "aapke area";
  const niche = lead.category;

  const opener = hasGoodRating && reviews > 10
    ? `Namaste! 🙏\n\nMain ${city} mein ${niche} businesses research kar raha tha aur aapka Google profile dekha — ${rating}★ aur ${reviews}+ reviews, waakai impressive hai!`
    : `Namaste! 🙏\n\nMain ${city} mein local ${niche} businesses ka analysis kar raha tha aur *${name}* ki profile pe aaya.`;

  const problemSection = topProblems.length > 1
    ? `Lekin ek detailed analysis karne ke baad *${topProblems.length} critical gaps* mile jo aapko customers se door kar rahe hain:\n\n*1. ${topProblems[0].label}*\n${topProblems[0].why}\n\n*2. ${topProblems[1].label}*\n${topProblems[1].why}`
    : `Lekin ek technical analysis karne ke baad ek badi problem notice ki:\n\n*${mainProblem.label}*\n${mainProblem.why}`;

  const solutionSection = `✅ *Solution Ready Hai:*\n${mainProblem.fix}\n\nMaine aapke business ke liye ek custom demo already banaya hai jo in sab issues ko fix karta hai.`;

  const cta = `Kya main demo link aur ek short analysis report yahan share kar sakta hoon? Sirf 2 min lagenge dekhne mein. 🤝`;

  const first = `${opener}\n\n${problemSection}\n\n${solutionSection}\n\n${cta}`;

  const followUp = `Hi! 👋 Ek quick follow-up — ab main confidently bol sakta hoon ki in gaps ki wajah se aap approximately *₹${estLoss.toLocaleString("en-IN")}/month* miss kar rahe hain.\n\nDemo aur full report ready hai. Kya main share karu? Bilkul free hai, koi pressure nahi. 🙏`;

  return { first, followUp };
}

function buildEmailHinglish(lead: RankedLead): { first: string; followUp: string } {
  const { mainProblem, topProblems, hasGoodRating, estLoss, rating, reviews } = analyse(lead);
  const name = lead.name;
  const city = lead.city || "aapke area";
  const niche = lead.category;

  const subject = `Subject: ${name} — Maine ek website issue find kiya jo customers kho raha hai\n\n`;

  const opener = hasGoodRating
    ? `Namaste,\n\n${city} mein ${niche} businesses research karte waqt ${name} ki profile mili. Google par ${rating}★ aur ${reviews}+ reviews bahut achha performance hai!`
    : `Namaste,\n\n${city} mein local ${niche} businesses ka technical audit karte waqt ${name} ki profile ka analysis kiya.`;

  const problemSection = topProblems.length > 1
    ? `Lekin ek detailed technical audit ke baad *${topProblems.length} serious issues* mile jo directly new customers ko rokk rahe hain:\n\n📌 **Problem 1: ${topProblems[0].label}**\n${topProblems[0].why}\n\n📌 **Problem 2: ${topProblems[1].label}**\n${topProblems[1].why}`
    : `Lekin ek technical audit ke baad ek significant issue mile:\n\n📌 **${mainProblem.label}**\n${mainProblem.why}`;

  const solutionSection = `✅ **Solution:**\n${mainProblem.fix}\n\nMain ${niche} businesses ke liye specialised solutions build karta hoon. Maine aapke business ke specific requirements ke liye ek demo bhi ready kiya hai.`;

  const cta = `Kya main aapko demo link aur detailed audit report send kar sakta hoon? Isme aapka koi cost nahi hoga.\n\nBest regards,\n[Aapka Naam]`;

  const first = `${subject}${opener}\n\n${problemSection}\n\n${solutionSection}\n\n${cta}`;

  const followUp = `Subject: Re: ${name} — ₹${estLoss.toLocaleString("en-IN")}/month loss ho raha hai\n\nNamaste,\n\nPichle email ka ek quick follow-up. Hamare detailed analysis ke basis par, currently identified issues ki wajah se approximately **₹${estLoss.toLocaleString("en-IN")} per month** potential revenue miss ho raha hai.\n\nDemo aur full technical report ready hai. Kya main share karu?\n\nBest regards,\n[Aapka Naam]`;

  return { first, followUp };
}

function buildWhatsappEnglish(lead: RankedLead): { first: string; followUp: string } {
  const { mainProblem, topProblems, hasGoodRating, isHighVolume, estLoss, rating, reviews } = analyse(lead);
  const name = lead.name;
  const city = lead.city || "your area";
  const niche = lead.category;

  const opener = hasGoodRating && isHighVolume
    ? `Hey! 👋\n\nI was researching ${niche} businesses in ${city} and your Google profile caught my eye — ${rating}★ with ${reviews}+ reviews is genuinely impressive!`
    : hasGoodRating
    ? `Hey! 👋\n\nWas looking at ${niche} businesses in ${city} — your ${rating}★ Google rating stands out!`
    : `Hey! 👋\n\nI was doing a digital audit of local ${niche} businesses in ${city} and came across ${name}.`;

  const problemSection = topProblems.length > 1
    ? `But I ran a quick technical check and found *${topProblems.length} issues* that are actively costing you customers:\n\n*1. ${topProblems[0].label}*\n${topProblems[0].why}\n\n*2. ${topProblems[1].label}*\n${topProblems[1].why}`
    : `But I spotted one critical issue that's quietly costing you customers:\n\n*${mainProblem.label}*\n${mainProblem.why}`;

  const solutionSection = `💡 *Here's the fix:*\n${mainProblem.fix}\n\nI've already built a custom demo for ${name} showing exactly how this would look.`;

  const cta = `Mind if I send over the demo link + a quick audit summary? Totally free, no obligations. Should take you 2 mins to review. 🙏`;

  const first = `${opener}\n\n${problemSection}\n\n${solutionSection}\n\n${cta}`;

  const followUp = `Hey, quick follow-up! 👋\n\nBased on the technical data, the issues I found are costing you roughly *₹${estLoss.toLocaleString("en-IN")}/month* in missed revenue.\n\nI have the demo and full audit ready to share. Want me to send it over? Zero cost, zero pressure. 😊`;

  return { first, followUp };
}

function buildEmailEnglish(lead: RankedLead): { first: string; followUp: string } {
  const { mainProblem, topProblems, hasGoodRating, estLoss, rating, reviews } = analyse(lead);
  const name = lead.name;
  const city = lead.city || "your area";
  const niche = lead.category;

  const subject = `Subject: Found a technical issue hurting ${name}'s customer growth\n\n`;

  const opener = hasGoodRating
    ? `Hi,\n\nI was researching ${niche} businesses in ${city} — your ${rating}★ rating with ${reviews}+ reviews on Google is great social proof!`
    : `Hi,\n\nI ran a technical audit of ${niche} businesses in ${city} and came across ${name}.`;

  const problemSection = topProblems.length > 1
    ? `However, my technical analysis flagged **${topProblems.length} critical issues** that are silently preventing new customers from reaching you:\n\n📍 **Issue 1: ${topProblems[0].label}**\n${topProblems[0].why}\n\n📍 **Issue 2: ${topProblems[1].label}**\n${topProblems[1].why}`
    : `However, my technical audit flagged a critical issue that's silently costing you new customers:\n\n📍 **${mainProblem.label}**\n${mainProblem.why}`;

  const solutionSection = `**The Solution:**\n${mainProblem.fix}\n\nI specialise in building high-performance websites for ${niche} businesses and have already created a tailored demo for ${name}.`;

  const cta = `Would you be open to me sharing the demo link and a detailed audit report? There's no cost and no commitment — just a clear picture of the opportunity.\n\nBest,\n[Your Name]`;

  const first = `${subject}${opener}\n\n${problemSection}\n\n${solutionSection}\n\n${cta}`;

  const followUp = `Subject: Re: ${name} — ₹${estLoss.toLocaleString("en-IN")}/month in missed revenue\n\nHi,\n\nJust following up on my previous email. Based on the technical data from my audit, the identified issues are estimated to be costing ${name} approximately **₹${estLoss.toLocaleString("en-IN")} per month** in missed customer revenue.\n\nI have the custom demo and full audit report ready. Would it be okay if I shared it here?\n\nBest,\n[Your Name]`;

  return { first, followUp };
}

export async function POST(req: Request) {
  try {
    const { lead, channel, language } = (await req.json()) as {
      lead: RankedLead;
      channel: string;
      language: string;
    };

    if (!lead) {
      return NextResponse.json({ error: "No lead data provided." }, { status: 400 });
    }

    let result: { first: string; followUp: string };

    if (language === "hinglish") {
      result = channel === "email"
        ? buildEmailHinglish(lead)
        : buildWhatsappHinglish(lead);
    } else {
      result = channel === "email"
        ? buildEmailEnglish(lead)
        : buildWhatsappEnglish(lead);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[Outreach Engine] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate message." },
      { status: 500 }
    );
  }
}
