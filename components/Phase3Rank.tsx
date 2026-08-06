"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhaseShell } from "./PhaseShell";
import { IncompleteState } from "./IncompleteState";
import { Crown, IndianRupee, MessageCircle, Phone, Mail, Search } from "lucide-react";
import type { Lead, AuditResult, RankedLead } from "@/lib/types";
import { scoreLead } from "@/lib/scoring";

export function Phase3Rank({
  leads,
  audits,
  selectedId,
  setSelectedId,
  onNext,
  onPrev,
}: {
  leads: Lead[];
  audits: Record<string, AuditResult>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const allRanked = useMemo(() => {
    return leads
      .filter((l) => audits[l.id])
      .map((l) => scoreLead(l, audits[l.id]))
      .sort((a, b) => b.score - a.score);
  }, [leads, audits]);

  const ranked = useMemo(() => {
    if (!searchQuery.trim()) return allRanked;
    const q = searchQuery.toLowerCase();
    return allRanked.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      (l.phone && l.phone.toLowerCase().includes(q))
    );
  }, [allRanked, searchQuery]);

  if (allRanked.length === 0) {
    return (
      <PhaseShell
        title="Phase 3 — Ranked prospects"
        subtitle="Conversion score blends site quality, review volume, rating, reachability, and industry fit. Pick one to build for."
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled
        nextLabel="Build website"
      >
        <IncompleteState
          title={leads.length === 0 ? "No leads scraped yet" : "No audits yet"}
          description={
            leads.length === 0
              ? "Phases 1 and 2 haven't been run. After scraping leads and auditing them, this page ranks each by conversion potential and lets you pick one to build for."
              : "Run an audit in Phase 2 first. Once leads have audits, we score them on site quality, review volume, rating, reachability, and industry fit — then sort for highest conversion potential."
          }
          prevPhaseLabel={leads.length === 0 ? "Scrape" : "Audit"}
          onPrev={onPrev}
        />
      </PhaseShell>
    );
  }

  return (
    <PhaseShell
      title="Phase 3 — Ranked prospects"
      subtitle="Conversion score blends site quality, review volume, rating, reachability, and industry fit. Pick one to build for."
      onPrev={onPrev}
      onNext={onNext}
      nextDisabled={!selectedId}
      nextLabel="Build website"
    >
      {ranked.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4 mb-4">
          {ranked.slice(0, 3).map((lead, i) => (
          <motion.div
            key={lead.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              role="button"
              tabIndex={0}
              aria-pressed={selectedId === lead.id}
              aria-label={`Select rank ${i + 1}: ${lead.name}`}
              onClick={() => setSelectedId(lead.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(lead.id);
                }
              }}
              className={`cursor-pointer transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-0.5 ${
                selectedId === lead.id
                  ? "ring-1 ring-primary border-primary/30"
                  : "hover:border-primary/30"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 font-medium tracking-wide uppercase text-muted-foreground">
                    <Crown className="h-3.5 w-3.5 text-[color:var(--chart-4)]" strokeWidth={1.5} />
                    Rank · {String(i + 1).padStart(2, "0")}
                  </CardTitle>
                  <div className="font-display text-3xl tabular-nums leading-none">{lead.score}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-medium text-base leading-snug">{lead.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{lead.address}</div>
                <div className="mt-4 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3 text-muted-foreground" />{lead.audit.estLostRevenuePerMonth.toLocaleString("en-IN")}/mo</span>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground">{lead.reviewsCount} reviews</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {lead.phone && <Phone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />}
                  {lead.whatsapp && <MessageCircle className="h-3.5 w-3.5 text-[color:var(--accent-foreground)]" strokeWidth={1.5} />}
                  {lead.email && <Mail className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>All ranked</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search leads..."
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
                  <TableHead className="w-[260px]">Score</TableHead>
                  <TableHead>₹ Lost / mo</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Select</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    aria-selected={selectedId === lead.id}
                    className={`border-b border-border cursor-pointer transition-colors duration-150 hover:bg-muted/40 ${selectedId === lead.id ? "bg-primary/5" : ""}`}
                    onClick={() => setSelectedId(lead.id)}
                  >
                    <TableCell className="font-medium tabular-nums">{i + 1}</TableCell>
                    <TableCell className="py-3.5 align-top">
                      {(() => {
                        const delimiters = [':', ' - ', ' – ', ' \\| '];
                        let title = lead.name;
                        let subtitle = '';

                        const actualDelimiters = [':', ' - ', ' – ', '|'];
                        for (const delimiter of actualDelimiters) {
                          if (lead.name.includes(delimiter)) {
                            const parts = lead.name.split(delimiter);
                            title = parts[0].trim();
                            subtitle = parts.slice(1).join(delimiter).trim();
                            break;
                          }
                        }

                        if (!subtitle && lead.name.length > 45 && lead.name.includes(',')) {
                          const parts = lead.name.split(',');
                          title = parts[0].trim();
                          subtitle = parts.slice(1).join(',').trim();
                        }

                        return (
                          <div className="flex flex-col gap-0.5 max-w-[200px] sm:max-w-[260px] md:max-w-[300px] overflow-hidden">
                            <div className="font-semibold text-foreground leading-tight text-sm break-words">
                              {title}
                            </div>
                            {subtitle && (
                              <div className="text-[10px] text-muted-foreground/80 leading-normal italic break-words">
                                {subtitle}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground/75 mt-1 font-mono">
                              {lead.reviewsCount} reviews · {lead.rating}★
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${lead.score}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                            className="h-full bg-primary"
                          />
                        </div>
                        <span className="font-mono text-sm tabular-nums w-9 text-right">{lead.score}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-sm">₹{lead.audit.estLostRevenuePerMonth.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      {lead.audit.hasWebsite ? (
                        (() => {
                          const score = lead.audit.pageSpeedScore;
                          let status = "Poor";
                          let badgeClass = "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30";
                          
                          if (score >= 80) {
                            status = "Best";
                            badgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30";
                          } else if (score >= 50) {
                            status = "Good";
                            badgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30";
                          }
                          
                          return (
                            <Badge variant="outline" className={cn("text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5", badgeClass)}>
                              {score} · {status}
                            </Badge>
                          );
                        })()
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 text-destructive border-destructive/20 bg-destructive/5">
                          No Site
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={selectedId === lead.id ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(lead.id);
                        }}
                      >
                        {selectedId === lead.id ? "Selected" : "Select"}
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
            {ranked.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No leads match search query</div>
            )}
          </div>
        </CardContent>
      </Card>
    </PhaseShell>
  );
}
