"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Stepper } from "@/components/Stepper";
import { Phase1Scrape } from "@/components/Phase1Scrape";
import { Phase2Audit } from "@/components/Phase2Audit";
import { Phase3Rank } from "@/components/Phase3Rank";
import { Phase4Build } from "@/components/Phase4Build";
import { Phase5Outreach } from "@/components/Phase5Outreach";
import { scoreLead } from "@/lib/scoring";
import type { Lead, AuditResult } from "@/lib/types";
import { Sparkles, Compass, ArrowLeftRight, Briefcase } from "lucide-react";
import Link from "next/link";

export default function Page() {
  const [phase, setPhase] = useState(1);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [audits, setAudits] = useState<Record<string, AuditResult>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const completed = useMemo(() => {
    const s = new Set<number>();
    if (leads.length > 0) s.add(1);
    if (Object.keys(audits).length > 0) s.add(2);
    if (selectedId) {
      s.add(3);
      s.add(4);
    }
    return s;
  }, [leads, audits, selectedId]);

  const selectedRanked = useMemo(() => {
    if (!selectedId) return null;
    const lead = leads.find((l) => l.id === selectedId);
    const audit = audits[selectedId];
    if (!lead || !audit) return null;
    return scoreLead(lead, audit);
  }, [selectedId, leads, audits]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-foreground focus:text-background focus:px-3 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to content
      </a>

      {/* Sidebar - fixed on desktop, top bar on mobile */}
      <aside className="w-full md:w-64 lg:w-72 md:fixed md:inset-y-0 md:left-0 bg-card border-b md:border-b-0 md:border-r border-border z-30 flex flex-col justify-between p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-8">
          {/* Project Switcher Selector */}
          <div className="relative">
            <div 
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/60 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-display text-sm leading-none font-bold text-foreground">Lead → Launch</div>
                  <div className="text-[10px] text-muted-foreground font-medium mt-1">Leads Extractor</div>
                </div>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </div>

            {isSwitcherOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 p-1 bg-card border border-border rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-3 py-1.5">
                  Switch Projects
                </div>
                
                {/* Active Project indicator */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Lead → Launch</div>
                    <div className="text-[9px] text-primary/80">Active Pipeline</div>
                  </div>
                </div>

                {/* Switch to JobFinder AI */}
                <Link href="/search" onClick={() => setIsSwitcherOpen(false)}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1">
                    <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">JobFinder AI</div>
                      <div className="text-[9px] text-muted-foreground">Job Aggregator Platform</div>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
          
          {/* Quick Access Icon (Rendered below Switcher or can be omitted since we have switch project) */}
          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
            <span>Advanced Extractor:</span>
            <Link href="/extractor" title="Advanced Extractor">
              <button className="p-1.5 rounded-md hover:bg-muted border border-border/50 hover:text-primary transition-colors cursor-pointer" aria-label="Advanced Extractor">
                <Compass className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
          
          {/* Steps Indicator (Vertical on desktop, horizontal on mobile) */}
          <div className="mt-2 md:mt-4">
            <div className="hidden md:block text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80 mb-3">
              Pipeline Stages
            </div>
            <Stepper current={phase} completed={completed} onJump={(n) => setPhase(n)} />
          </div>
        </div>

        {/* Sidebar Footer info */}
        <div className="hidden md:flex flex-col gap-2 pt-4 border-t border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Local Engine Active
          </div>
          <div>Private & Yours</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-h-screen">
        <main id="main" className="flex-1 p-4 md:p-8" tabIndex={-1}>
          <AnimatePresence mode="wait">
            {phase === 1 && (
              <Phase1Scrape
                key="p1"
                leads={leads}
                setLeads={setLeads}
                onNext={() => setPhase(2)}
              />
            )}
            {phase === 2 && (
              <Phase2Audit
                key="p2"
                leads={leads}
                setLeads={setLeads}
                audits={audits}
                setAudits={setAudits}
                onNext={() => setPhase(3)}
                onPrev={() => setPhase(1)}
              />
            )}
            {phase === 3 && (
              <Phase3Rank
                key="p3"
                leads={leads}
                audits={audits}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onNext={() => setPhase(4)}
                onPrev={() => setPhase(2)}
              />
            )}
            {phase === 4 && (
              <Phase4Build
                key="p4"
                selected={selectedRanked}
                onNext={() => setPhase(5)}
                onPrev={() => setPhase(3)}
              />
            )}
            {phase === 5 && (
              <Phase5Outreach
                key="p5"
                selected={selectedRanked}
                onPrev={() => setPhase(4)}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
