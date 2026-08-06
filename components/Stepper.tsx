"use client";

import { motion } from "framer-motion";
import { Check, Search, FileSearch, Trophy, Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Scrape", icon: Search, description: "Extract lead data" },
  { id: 2, label: "Audit", icon: FileSearch, description: "Analyze performance" },
  { id: 3, label: "Rank", icon: Trophy, description: "Score conversion" },
  { id: 4, label: "Build", icon: Sparkles, description: "Generate pitches" },
  { id: 5, label: "Outreach", icon: Send, description: "Launch campaigns" },
];

export function Stepper({
  current,
  completed,
  onJump,
}: {
  current: number;
  completed: Set<number>;
  onJump: (n: number) => void;
}) {
  return (
    <div className="w-full flex flex-col gap-4 py-4 md:py-6" role="navigation" aria-label="Pipeline progress">
      {/* Step nodes wrapper */}
      <div className="flex flex-row md:flex-col justify-between md:justify-start gap-4 md:gap-8 w-full relative">
        
        {/* Background connector line for desktop */}
        <div className="hidden md:block absolute left-[19px] top-6 bottom-6 w-[2px] bg-border/40 z-0">
          <motion.div 
            className="w-full bg-primary"
            initial={{ height: 0 }}
            animate={{ 
              height: `${((current - 1) / (STEPS.length - 1)) * 100}%` 
            }}
            transition={{ duration: 0.3 }}
            style={{ originY: 0 }}
          />
        </div>

        {/* Background connector line for mobile */}
        <div className="block md:hidden absolute top-[19px] left-6 right-6 h-[2px] bg-border/40 z-0">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ 
              width: `${((current - 1) / (STEPS.length - 1)) * 100}%` 
            }}
            transition={{ duration: 0.3 }}
            style={{ originX: 0 }}
          />
        </div>

        {STEPS.map((step) => {
          const isDone = completed.has(step.id);
          const isCurrent = current === step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-4 z-10 flex-1 md:flex-none">
              <button
                type="button"
                onClick={() => onJump(step.id)}
                className="flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-4 text-left group focus-visible:outline-none cursor-pointer"
              >
                {/* Step indicator circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.05 : 1,
                    backgroundColor: isCurrent ? "var(--primary)" : isDone ? "var(--accent)" : "var(--card)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border transition-all shadow-sm",
                    isCurrent
                      ? "border-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                      : isDone
                        ? "border-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:border-slate-400"
                  )}
                >
                  {isDone && !isCurrent ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </motion.div>

                {/* Step Label */}
                <div className="flex flex-col text-center md:text-left mt-0.5">
                  <span className={cn(
                    "text-[10px] md:text-xs tracking-wider uppercase font-semibold transition-colors",
                    isCurrent ? "text-foreground font-bold" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {step.label}
                  </span>
                  <span className="hidden md:block text-[11px] text-muted-foreground/80 mt-0.5 leading-tight">
                    {step.description}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
