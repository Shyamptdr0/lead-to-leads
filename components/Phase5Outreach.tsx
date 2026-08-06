"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhaseShell } from "./PhaseShell";
import { IncompleteState } from "./IncompleteState";
import { MessageCircle, Mail, Camera, Copy, ExternalLink, Sparkles, Settings } from "lucide-react";
import type { RankedLead, OutreachChannel, OutreachLanguage } from "@/lib/types";
import { toast } from "sonner";

export function Phase5Outreach({
  selected,
  onPrev,
}: {
  selected: RankedLead | null;
  onPrev: () => void;
}) {
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [lang, setLang] = useState<OutreachLanguage>("english");
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageCache, setMessageCache] = useState<Record<string, { first: string; followUp: string }>>({});

  const [apiProvider, setApiProvider] = useState<"none" | "wassenger" | "twochat">("none");
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<Record<string, "active" | "inactive" | "unknown">>({});

  useEffect(() => {
    const p = localStorage.getItem("ltl_whatsapp_provider") as any;
    const k = localStorage.getItem("ltl_whatsapp_key") || "";
    if (p) setApiProvider(p);
    if (k) setApiKey(k);
  }, []);

  const saveSettings = (provider: "none" | "wassenger" | "twochat", key: string) => {
    setApiProvider(provider);
    setApiKey(key);
    localStorage.setItem("ltl_whatsapp_provider", provider);
    localStorage.setItem("ltl_whatsapp_key", key);
    toast.success("Outreach checker settings saved!");
    setShowSettings(false);
  };

  const checkWhatsapp = async () => {
    if (!selected?.phone) return;
    setCheckingWhatsapp(true);
    try {
      const res = await fetch("/api/check-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selected.phone,
          apiKey: apiProvider !== "none" ? apiKey : undefined,
          provider: apiProvider
        })
      });
      const data = await res.json();
      if (data.success) {
        setWhatsappStatus(prev => ({
          ...prev,
          [selected.id]: data.exists ? "active" : "inactive"
        }));
        toast.success(data.message || "WhatsApp status checked!");
      } else {
        toast.error(data.error || "Failed to check WhatsApp status");
      }
    } catch (err) {
      toast.error("Failed to connect to verification engine");
    } finally {
      setCheckingWhatsapp(false);
    }
  };

  useEffect(() => {
    if (!selected) return;
    const cacheKey = `${selected.id}-${channel}-${lang}`;
    if (messageCache[cacheKey]) {
      setMessage(messageCache[cacheKey].first);
      setFollowUp(messageCache[cacheKey].followUp);
    } else {
      const m = buildOutreach(selected, channel, lang);
      setMessage(m.first);
      setFollowUp(m.followUp);
    }
  }, [selected, channel, lang, messageCache]);

  const generateAI = async () => {
    if (!selected) return;
    const cacheKey = `${selected.id}-${channel}-${lang}`;
    
    setIsGenerating(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: selected,
          channel,
          language: lang,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate AI message");
      }

      const data = await res.json();
      setMessageCache((prev) => ({
        ...prev,
        [cacheKey]: { first: data.first, followUp: data.followUp },
      }));
      toast.success("AI personalized draft generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI message.");
    } finally {
      setIsGenerating(false);
    }
  };

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function openChannel() {
    if (!selected) return;
    if (channel === "whatsapp" && selected.whatsapp) {
      const num = selected.whatsapp.replace(/\D/g, "");
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, "_blank");
    } else if (channel === "email" && selected.email) {
      const subject = lang === "hinglish" ? "Aapke business ke liye ek website demo banayi hai" : "Built a website demo for your business";
      window.open(`mailto:${selected.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, "_blank");
    } else if (channel === "instagram") {
      if (selected.instagram) {
        window.open(selected.instagram, "_blank");
      } else {
        window.open(`https://instagram.com/`, "_blank");
      }
    } else {
      toast.error("No contact for this channel");
    }
  }

  if (!selected) {
    return (
      <PhaseShell
        title="Phase 5 — Outreach"
        subtitle="Hinglish-first by default — converts 3x better in India. Built-in 5-day follow-up."
        onPrev={onPrev}
      >
        <IncompleteState
          title="No lead selected yet"
          description="Outreach drafts are tailored to a specific lead — picking up name, biggest gap, review count, and reachable channels. Run earlier phases and select a prospect to see WhatsApp, email, and Instagram drafts here."
          prevPhaseLabel="Rank"
          onPrev={onPrev}
        />
      </PhaseShell>
    );
  }

  const channels: { id: OutreachChannel; label: string; icon: typeof MessageCircle; enabled: boolean }[] = [
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, enabled: !!selected.whatsapp },
    { id: "email", label: "Email", icon: Mail, enabled: !!selected.email },
    { id: "instagram", label: "Instagram", icon: Camera, enabled: true },
  ];

  return (
    <PhaseShell title="Phase 5 — Outreach" subtitle="Hinglish-first by default — converts 3x better in India. Built-in 5-day follow-up." onPrev={onPrev}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sending to</div>
          <div className="font-display text-2xl mt-1">{selected.name}</div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{selected.phone}</span>
            {selected.email && <span>· {selected.email}</span>}
            {selected.instagram && (
              <span className="text-pink-500">
                · Instagram: <a href={selected.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">{selected.instagram.split('instagram.com/')[1] || "Link"}</a>
              </span>
            )}
            {selected.phone && (
              <span className="flex items-center gap-1.5 ml-2">
                {(() => {
                  const status = whatsappStatus[selected.id] || "unknown";
                  if (status === "active") {
                    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-normal uppercase py-0 px-2 h-5">🟢 Active on WA</Badge>;
                  }
                  if (status === "inactive") {
                    return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] font-normal uppercase py-0 px-2 h-5">🔴 Not on WA</Badge>;
                  }
                  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-normal uppercase py-0 px-2 h-5">🟡 WA: Unknown</Badge>;
                })()}
                
                <button 
                  onClick={checkWhatsapp} 
                  disabled={checkingWhatsapp}
                  className="h-5 px-1.5 text-[10px] py-0 border border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground font-normal rounded-sm cursor-pointer"
                >
                  {checkingWhatsapp ? "Checking..." : "Verify WA"}
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="lang" className="text-sm">English</Label>
            <Switch id="lang" checked={lang === "hinglish"} onCheckedChange={(c) => setLang(c ? "hinglish" : "english")} />
            <Label htmlFor="lang" className="text-sm">Hinglish</Label>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowSettings(!showSettings)}
            className="h-9 px-3 border-border hover:bg-muted text-xs flex items-center gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" /> WA Settings
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="mb-6 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">WhatsApp Verification Settings</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Integrate Wassenger or 2Chat free trials to check if phone numbers are registered on WhatsApp. Keys are stored locally in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider-select" className="text-xs uppercase tracking-wider text-muted-foreground">API Provider</Label>
                <select 
                  id="provider-select"
                  value={apiProvider} 
                  onChange={(e) => setApiProvider(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="none">None (Offline Format Check)</option>
                  <option value="wassenger">Wassenger API</option>
                  <option value="twochat">2Chat API</option>
                </select>
              </div>
              
              {apiProvider !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="api-key-input" className="text-xs uppercase tracking-wider text-muted-foreground">API Key / Token</Label>
                  <Input 
                    id="api-key-input"
                    type="password" 
                    placeholder="Enter your API key" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-9 bg-background border-border text-foreground placeholder-muted-foreground"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => saveSettings(apiProvider, apiKey)}>Save Settings</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        {channels.map(({ id, label, icon: Icon, enabled }) => (
          <Button
            key={id}
            variant={channel === id ? "default" : "outline"}
            size="sm"
            disabled={!enabled}
            onClick={() => setChannel(id)}
          >
            <Icon className="h-4 w-4 mr-2" /> {label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>First message</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20" onClick={generateAI} disabled={isGenerating}>
                {isGenerating ? "Generating..." : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate AI</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(message)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              <Button size="sm" onClick={openChannel}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Send</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Hook: personal · Pain: their biggest gap · Demo: live link · CTA: low-friction yes/no
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Day-3 follow-up (auto-draft)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => copy(followUp)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy follow-up</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 bg-accent/40 border-accent">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-base">✓</div>
            <div>
              <div className="font-medium tracking-tight">Pipeline complete</div>
              <div className="text-sm text-muted-foreground">Lead → audit → ranked → site → outreach. Repeat for next prospect in Phase 3.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </PhaseShell>
  );
}

function buildOutreach(l: RankedLead, channel: OutreachChannel, lang: OutreachLanguage): { first: string; followUp: string } {
  const ownerName = l.name.includes("Dr.") ? l.name.split(",")[0].replace(/['s].*/, "").trim() : "there";
  const niche = l.category.toLowerCase();
  const reviews = l.reviewsCount ?? 0;
  const rating = l.rating ?? 4.5;

  if (lang === "hinglish") {
    if (channel === "whatsapp") {
      return {
        first: `Hi ${ownerName} 👋

${l.city} mein ${niche} options mein aapki ratings and reviews bahut badhiya hain (${rating}★, ${reviews}+ reviews).

Bas ek problem notice ki: ${l.audit.biggestGap}

Solution: Maine ek custom mobile-friendly website demo design kiya hai aapke business ke liye, jisse direct bookings and local sales badh sakein.

Kya main link yahan share karu check karne ke liye?`,
        followUp: `Hi ${ownerName}, quick follow up. Hamare estimate ke according is problem ki wajah se aap monthly up to ₹${l.audit.estLostRevenuePerMonth.toLocaleString("en-IN")} sales miss kar rahe hain. 

Maine demo preview link ready rakha hai, kya main use yahan share kar sakta hoon?`,
      };
    }
    if (channel === "email") {
      return {
        first: `Subject: Quick fix to increase sales for ${l.name}

Hi ${ownerName},

${l.city} mein ${niche} options check karte waqt aapki profile dekhne ko mili. Google par aapki ratings and reviews bahut badhiya hain (${rating}★, ${reviews}+ reviews).

Lekin aapki online presence analyze karte waqt ek choti si problem notice ki:
Problem: ${l.audit.biggestGap}
(Is wajah se online customers and bookings miss ho rahe hain)

Solution: Maine iska ek modern solution design kiya hai — ek fast, mobile-friendly website demo jisme WhatsApp booking flow integrated hai.

Kya main iska preview link reply mein share karu check karne ke liye?

Regards,
[Your Name]`,
        followUp: `Subject: Re: Quick fix to increase sales for ${l.name}

Hi ${ownerName},

Pichli email pe quick check-in. Conservative estimate ke according, missing bookings ki wajah se aap monthly around ₹${l.audit.estLostRevenuePerMonth.toLocaleString("en-IN")} loss kar rahe hain.

Kya main demo link share karu for a quick look?

Regards,
[Your Name]`,
      };
    }
    return {
      first: `Hi! Aapke business ${l.name} ke liye ek custom website demo ready kiya hai jo bookings & sales badhane mein help karega. Kya main preview link share karu?`,
      followUp: `Hey, follow up on the website demo. Is issue se sales par impact aa raha hai. Kya main check karne ke liye link bhej du?`,
    };
  }

  // English
  if (channel === "whatsapp") {
    return {
      first: `Hi ${ownerName} 👋

Was researching local businesses and saw your Google profile for ${l.name} in ${l.city}. Your ratings are amazing (${rating}★, ${reviews}+ reviews)!

I noticed one critical gap though: ${l.audit.biggestGap}

Solution: I designed a quick, mobile-friendly landing page with direct booking support to capture these lost bookings.

Should I send the preview link over?`,
      followUp: `Hi ${ownerName}, following up on my previous message. Based on search volume, this gap is costing you roughly ₹${l.audit.estLostRevenuePerMonth.toLocaleString("en-IN")}/month in missed business. 

Would it be okay if I share the demo link here?`,
    };
  }
  if (channel === "email") {
    return {
      first: `Subject: Direct way to increase bookings for ${l.name}

Hi ${ownerName},

I was analyzing local ${niche} businesses in ${l.city} and came across ${l.name}. Your Google reviews are fantastic (${rating}★, ${reviews}+ reviews).

However, I noticed a bottleneck that is costing you potential customers:
Problem: ${l.audit.biggestGap}

Solution: I designed a fast-loading website demo with a seamless WhatsApp booking workflow to capture these leads and increase sales.

Would you be open to checking the preview link?

Best regards,
[Your Name]`,
      followUp: `Subject: Re: Direct way to increase bookings for ${l.name}

Hi ${ownerName},

Just checking in on my previous email. Based on local search volume, this issue is costing you roughly ₹${l.audit.estLostRevenuePerMonth.toLocaleString("en-IN")}/month in missed revenue.

Would you like me to share the preview link here?

Best regards,
[Your Name]`,
    };
  }
  return {
    first: `Hi! Built a quick website demo for ${l.name} to capture more bookings and mobile users. Should I send the preview link over?`,
    followUp: `Hey, following up on the website demo. Let me know if I can share the link here for you to review.`,
  };
}
