"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PhaseShell } from "./PhaseShell";
import { Loader2, MapPin, Phone, Star, Globe, MessageCircle, Mail, Search } from "lucide-react";
import type { Lead, ScrapeInput } from "@/lib/types";
import { toast } from "sonner";

const LeadMap = dynamic(() => import("./LeadMap"), { ssr: false });

export function Phase1Scrape({
  leads,
  setLeads,
  onNext,
  onPrev,
}: {
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
  onNext: () => void;
  onPrev?: () => void;
}) {
  const [input, setInput] = useState<ScrapeInput>({ niche: "", city: "", count: "" as unknown as number });
  const [provider, setProvider] = useState<'local' | 'apify'>(() => {
    if (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("now.sh"))) {
      return 'apify';
    }
    return 'local';
  });
  const [loading, setLoading] = useState(false);
  const [scrapedEmpty, setScrapedEmpty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      (l.phone && l.phone.toLowerCase().includes(q)) ||
      (l.website && l.website.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  async function runScrape(selectedProvider: 'local' | 'apify' = provider) {
    setLoading(true);
    setLeads([]);
    setScrapedEmpty(false);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, provider: selectedProvider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Scrape failed");
      }

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let currentLeads: Lead[] = [];

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                let data: any;
                try {
                  data = JSON.parse(line.slice(6));
                } catch (e) {
                  continue;
                }

                if (data.type === 'lead') {
                  currentLeads = [...currentLeads, data.lead];
                  setLeads(currentLeads);
                } else if (data.type === 'done') {
                  if (currentLeads.length === 0) {
                    setScrapedEmpty(true);
                    toast.error(`0 leads found using ${selectedProvider === 'local' ? 'Local' : 'Apify'} search.`);
                  } else {
                    toast.success(`${currentLeads.length} leads loaded via ${selectedProvider === 'local' ? 'Local Scraper' : 'Apify Cloud'}`);
                  }
                } else if (data.type === 'error') {
                  setScrapedEmpty(true);
                  toast.error(data.error || "Scraping error occurred.");
                }
              }
            }
          }
        }
      } else {
        // Fallback for non-streaming response
        const data = await res.json();
        if (!data.leads || data.leads.length === 0) {
          setScrapedEmpty(true);
          toast.error(`0 leads found using ${selectedProvider === 'local' ? 'Local' : 'Apify'} search.`);
        } else {
          for (let i = 0; i < data.leads.length; i++) {
            await new Promise((r) => setTimeout(r, 80));
            setLeads(data.leads.slice(0, i + 1));
          }
          toast.success(`${data.leads.length} leads scraped via ${selectedProvider === 'local' ? 'Local Scraper' : 'Apify Cloud'}`);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PhaseShell
      title="Phase 1 — Scrape leads"
      subtitle="Pull local businesses from Google Maps. We capture contact, reviews, photos, and location to score conversion potential."
      onPrev={onPrev}
      onNext={onNext}
      nextDisabled={leads.length === 0}
      nextLabel="Audit these leads"
    >
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="niche" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Niche</Label>
              <Input id="niche" autoComplete="off" value={input.niche} onChange={(e) => setInput({ ...input, niche: e.target.value })} placeholder="e.g. Dentist" className="h-10 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Location</Label>
              <Input id="city" autoComplete="off" value={input.city} onChange={(e) => setInput({ ...input, city: e.target.value })} placeholder="e.g. Bandra, Mumbai" className="h-10 text-base" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Scraper Engine</Label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setProvider('local')}
                  className={`py-1.5 px-3 rounded-md transition-all font-medium cursor-pointer ${
                    provider === 'local'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Local Free
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProvider('apify');
                    if (typeof input.count === 'number' && input.count > 20) {
                      setInput({ ...input, count: 20 });
                    }
                  }}
                  className={`py-1.5 px-3 rounded-md transition-all font-medium cursor-pointer ${
                    provider === 'apify'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Apify Cloud
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Count</Label>
              <Input id="count" type="number" inputMode="numeric" min={1} max={provider === 'apify' ? 20 : 50} value={input.count} onChange={(e) => {
                let val = e.target.value === "" ? "" as unknown as number : Number(e.target.value);
                if (provider === 'apify' && typeof val === 'number' && val > 20) val = 20;
                setInput({ ...input, count: val });
              }} className="h-10 text-base font-mono tabular-nums" />
              <p className="text-[11px] text-muted-foreground">{provider === 'apify' ? 'Max 20 for Apify engine.' : 'Max 50 leads.'}</p>
            </div>
            <Button onClick={() => runScrape(provider)} disabled={loading || !input.niche || !input.city || !input.count} className="w-full h-11 transition-transform duration-150 active:scale-[0.98]">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scraping...</> : "Scrape leads"}
            </Button>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Stat label="Found" value={leads.length} />
              <Stat label="With phone" value={leads.filter((l) => l.phone).length} />
              <Stat label="No site" value={leads.filter((l) => !l.website).length} />
            </div>

            {scrapedEmpty && (
              <div className="mt-4 p-4 rounded-md border border-destructive/20 bg-destructive/5 text-center space-y-3">
                <p className="text-xs text-muted-foreground leading-snug">
                  Local engine returned 0 leads. Try pulling from Apify cloud as a backup.
                </p>
                <Button
                  onClick={() => runScrape('apify')}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 cursor-pointer bg-red-950 hover:bg-red-900 border border-red-800 text-red-200"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Get leads from Apify
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Live map</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadMap leads={filteredLeads} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Results</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, category, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm font-normal"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Site</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filteredLeads.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-b border-border"
                    >
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="py-3.5 align-top">
                        {(() => {
                          const delimiters = [':', ' - ', ' – ', ' \\| '];
                          let title = l.name;
                          let subtitle = '';

                          // Try to split on common delimiters (including pipe symbol |)
                          const actualDelimiters = [':', ' - ', ' – ', '|'];
                          for (const delimiter of actualDelimiters) {
                            if (l.name.includes(delimiter)) {
                              const parts = l.name.split(delimiter);
                              title = parts[0].trim();
                              subtitle = parts.slice(1).join(delimiter).trim();
                              break;
                            }
                          }

                          if (!subtitle && l.name.length > 45 && l.name.includes(',')) {
                            const parts = l.name.split(',');
                            title = parts[0].trim();
                            subtitle = parts.slice(1).join(',').trim();
                          }

                          return (
                            <div className="flex flex-col gap-0.5 max-w-[220px] sm:max-w-[280px] md:max-w-[320px] overflow-hidden">
                              <div className="font-semibold text-foreground leading-tight text-sm md:text-base break-words">
                                {title}
                              </div>
                              {subtitle && (
                                <div className="text-[11px] text-muted-foreground/80 leading-normal italic break-words">
                                  {subtitle}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground/75 flex items-center gap-1 mt-1 font-mono">
                                <MapPin className="h-3 w-3 text-muted-foreground/45 shrink-0" />
                                <span className="truncate">{l.address}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {l.phone}</span>}
                          {l.whatsapp && <span className="flex items-center gap-1 text-[color:var(--accent-foreground)]"><MessageCircle className="h-3 w-3" /> WhatsApp</span>}
                          {l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {l.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-[color:var(--chart-4)] text-[color:var(--chart-4)]" />
                          <span className="font-medium">{l.rating?.toFixed(1)}</span>
                          <span className="text-muted-foreground text-xs">({l.reviewsCount})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.website ? (
                          <a
                            href={l.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-red-800 dark:text-red-400 hover:underline font-mono max-w-[160px]"
                          >
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{l.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic font-mono">No site</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
            {leads.length === 0 && !loading && (
              <div className="text-center py-12 text-sm text-muted-foreground">Run a scrape to populate leads</div>
            )}
            {leads.length > 0 && filteredLeads.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No leads match search query</div>
            )}
          </div>
        </CardContent>
      </Card>
    </PhaseShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
