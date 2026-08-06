"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { PhaseShell } from "./PhaseShell";
import { IncompleteState } from "./IncompleteState";
import { Loader2, AlertTriangle, IndianRupee, Gauge, Star, Phone, MessageCircle, Globe, Search } from "lucide-react";
import type { Lead, AuditResult } from "@/lib/types";
import { toast } from "sonner";

export function Phase2Audit({
  leads,
  setLeads,
  audits,
  setAudits,
  onNext,
  onPrev,
}: {
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
  audits: Record<string, AuditResult>;
  setAudits: (a: Record<string, AuditResult>) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Default-select all leads on mount or when leads change
  useEffect(() => {
    setSelectedIds(new Set(leads.map((l) => l.id)));
  }, [leads]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      (l.phone && l.phone.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const allSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id));
  const someSelected = filteredLeads.some((l) => selectedIds.has(l.id)) && !allSelected;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredLeads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredLeads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

  async function runAudit() {
    const targets = leads.filter((l) => selectedIds.has(l.id));
    if (targets.length === 0) {
      toast.error("Select at least one lead to audit");
      return;
    }
    setRunning(true);
    setProgress(0);
    try {
      const all: Record<string, AuditResult> = { ...audits };
      for (let i = 0; i < targets.length; i++) {
        const lead = targets[i];
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lead }),
        });
        const data = await res.json();
        all[lead.id] = data.audit;
        setAudits({ ...all });

        // Update the lead details in the parent state
        setLeads(leads.map((l) => {
          if (l.id === lead.id) {
            return {
              ...l,
              email: data.email || l.email,
              instagram: data.instagram || l.instagram,
              phone: data.phone || l.phone,
              whatsapp: data.phone || l.whatsapp,
            };
          }
          return l;
        }));

        setProgress(Math.round(((i + 1) / targets.length) * 100));
        await new Promise((r) => setTimeout(r, 150));
      }
      toast.success(`Audited ${targets.length} lead${targets.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const auditedCount = Object.keys(audits).length;
  const totalLost = Object.values(audits).reduce((s, a) => s + (a?.estLostRevenuePerMonth ?? 0), 0);

  // Incomplete state: Phase 1 not run yet
  if (leads.length === 0) {
    return (
      <PhaseShell
        title="Phase 2 — Business audit"
        subtitle="PageSpeed, mobile readiness, schema, gaps + AI-summarized biggest opportunity. Estimated revenue left on the table."
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled
        nextLabel="Rank prospects"
      >
        <IncompleteState
          title="No leads to audit yet"
          description="Phase 1 hasn't been run. Go back, run the scraper, and we'll audit each business's website performance, mobile readiness, and conversion gaps here."
          prevPhaseLabel="Scrape"
          onPrev={onPrev}
        />
      </PhaseShell>
    );
  }

  return (
    <PhaseShell
      title="Phase 2 — Business audit"
      subtitle="PageSpeed, mobile readiness, schema, gaps + AI-summarized biggest opportunity. Estimated revenue left on the table."
      onPrev={onPrev}
      onNext={onNext}
      nextDisabled={auditedCount === 0}
      nextLabel="Rank prospects"
    >
      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Audited</div>
            <div className="font-display text-3xl tabular-nums mt-2">{auditedCount}<span className="text-muted-foreground/50 text-2xl"> / {leads.length}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">No site at all</div>
            <div className="font-display text-3xl tabular-nums text-[color:var(--destructive)] mt-2">
              {Object.values(audits).filter((a) => !a.hasWebsite).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Avg PageSpeed</div>
            <div className="font-display text-3xl tabular-nums mt-2">
              {auditedCount ? Math.round(Object.values(audits).reduce((s, a) => s + a.pageSpeedScore, 0) / auditedCount) : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Est. ₹ lost / month</div>
            <div className="font-display text-3xl tabular-nums flex items-center mt-2">
              <IndianRupee className="h-6 w-6" strokeWidth={1.5} />{totalLost.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap flex-1 min-w-[280px]">
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label={allSelected ? "Deselect all leads" : "Select all leads"}
            />
            <span className="text-sm">
              {selectedIds.size === 0
                ? "Select leads to audit"
                : someSelected
                  ? `${selectedIds.size} of ${leads.length} selected`
                  : `All ${leads.length} selected`}
            </span>
          </label>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm font-normal"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {running && <div className="w-48"><Progress value={progress} /></div>}
          <Button
            onClick={runAudit}
            disabled={running || selectedIds.size === 0}
            className="h-10 px-4"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Auditing...</>
            ) : (
              <>Run audit{selectedIds.size === leads.length ? " on all leads" : ` on ${selectedIds.size} selected`}</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredLeads.map((lead, i) => {
          const a = audits[lead.id];
          const isSelected = selectedIds.has(lead.id);
          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className={`h-full transition-colors duration-200 ${isSelected ? "border-primary/30" : "hover:border-primary/20"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(lead.id)}
                      aria-label={`Select ${lead.name} for audit`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-medium leading-snug">{lead.name}</CardTitle>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">{lead.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Lead summary — always shown */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-[color:var(--chart-4)] text-[color:var(--chart-4)]" strokeWidth={1.5} />
                      <span className="font-mono tabular-nums">{lead.rating?.toFixed(1) ?? "—"}</span>
                      <span className="text-muted-foreground/70">({lead.reviewsCount ?? 0})</span>
                    </span>
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" strokeWidth={1.5} />
                        <span className="font-mono text-[11px]">{lead.phone.replace(/^\+91 /, "")}</span>
                      </span>
                    )}
                    {lead.whatsapp && (
                      <span className="flex items-center gap-1 text-[color:var(--accent-foreground)]">
                        <MessageCircle className="h-3 w-3" strokeWidth={1.5} /> WA
                      </span>
                    )}
                    {lead.website ? (
                      <Badge variant="secondary" className="text-[10px] font-normal h-5">
                        <Globe className="h-2.5 w-2.5 mr-1" strokeWidth={1.5} /> Has site
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-normal h-5 text-[color:var(--destructive)] border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5">
                        No site
                      </Badge>
                    )}
                  </div>

                  {a ? (
                    <>
                      <div className="flex items-center gap-3 pt-1 border-t border-border/60">
                        <PageSpeedGauge score={a.pageSpeedScore} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Est. lost / mo</div>
                          <div className="font-display text-lg tabular-nums flex items-center mt-0.5">
                            <IndianRupee className="h-3.5 w-3.5" strokeWidth={1.5} />{a.estLostRevenuePerMonth.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {a.gaps.slice(0, 3).map((g) => (
                          <Badge key={g} variant="outline" className="text-[10px] font-normal text-[color:var(--destructive)] border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/5">{g}</Badge>
                        ))}
                      </div>
                      <div className="rounded-md bg-muted/60 p-2.5 text-xs border border-border">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--chart-4)] mt-0.5 shrink-0" strokeWidth={1.75} />
                          <span className="text-muted-foreground italic leading-relaxed">{a.biggestGap}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center border-t border-border/60 pt-3">
                      <Gauge className="h-3.5 w-3.5" strokeWidth={1.5} /> Awaiting audit
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {leads.length > 0 && filteredLeads.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-card">
            No leads match search query
          </div>
        )}
      </div>
    </PhaseShell>
  );
}

function PageSpeedGauge({ score }: { score: number }) {
  const color = score === 0 ? "text-[color:var(--destructive)]" : score < 50 ? "text-[color:var(--destructive)]" : score < 70 ? "text-[color:var(--chart-4)]" : "text-[color:var(--accent-foreground)]";
  const ring = score === 0 ? "stroke-[color:var(--destructive)]" : score < 50 ? "stroke-[color:var(--destructive)]" : score < 70 ? "stroke-[color:var(--chart-4)]" : "stroke-[color:var(--accent-foreground)]";
  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r="22" className="stroke-muted fill-none" strokeWidth="5" />
        <motion.circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className={ring}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums ${color}`}>
        {score || "—"}
      </div>
    </div>
  );
}
