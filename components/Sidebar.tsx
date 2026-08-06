"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { 
  Briefcase, 
  Search, 
  Bookmark, 
  History, 
  Settings, 
  Sparkles, 
  ArrowLeftRight, 
  LogOut, 
  User, 
  Database,
  Cloud,
  ChevronDown,
  LogIn
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string>("apify");
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Fetch status info
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/jobs/save");
        const data = await res.json();
        setDbConnected(data.dbConnected);
      } catch (e) {
        setDbConnected(false);
      }
    }
    checkStatus();
    
    // Parse provider from some global settings or default
    // We can show whatever is set in process.env, but since it's client-side, 
    // we'll get it from a status or default config.
  }, []);

  const navItems = [
    { name: "Search Jobs", href: "/search", icon: Search },
    { name: "Saved Jobs", href: "/saved-jobs", icon: Bookmark },
    { name: "History", href: "/history", icon: History },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-full md:w-64 lg:w-72 md:fixed md:inset-y-0 md:left-0 bg-slate-900/60 backdrop-blur-xl border-b md:border-b-0 md:border-r border-slate-800/80 z-30 flex flex-col justify-between p-4 md:p-6 text-slate-200">
      <div className="flex flex-col gap-6 md:gap-8">
        
        {/* Project Switcher Selector */}
        <div className="relative">
          <div 
            onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Briefcase className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div>
                <div className="font-display font-bold text-sm tracking-wide text-white">JobFinder AI</div>
                <div className="text-[10px] text-blue-400 font-medium">Job Aggregator</div>
              </div>
            </div>
            <ArrowLeftRight className="h-4 w-4 text-slate-400" />
          </div>

          {isSwitcherOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 p-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold px-3 py-1.5">
                Switch Projects
              </div>
              
              {/* Switch to Lead Extractor */}
              <Link href="/" onClick={() => setIsSwitcherOpen(false)}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer">
                  <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Lead → Launch</div>
                    <div className="text-[9px] text-slate-400">Leads & Audits Engine</div>
                  </div>
                </div>
              </Link>

              {/* Active Project indicator */}
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-600/10 text-white border border-blue-500/20 mt-1">
                <div className="h-7 w-7 rounded-md bg-blue-500 flex items-center justify-center text-white">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold">JobFinder AI</div>
                  <div className="text-[9px] text-blue-300">Active Aggregator</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold px-3 mb-2">
            Workspace
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border-l-2 border-blue-500"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer with Session Profile & DB Status */}
      <div className="flex flex-col gap-4 pt-4 border-t border-slate-800/50">
        
        {/* Status Badges */}
        <div className="flex flex-col gap-2 px-1 text-[10px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cloud className="h-3 w-3 text-blue-400" />
              Scraper Engine:
            </span>
            <span className="font-semibold text-white uppercase bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">
              {process.env.NEXT_PUBLIC_SCRAPER_PROVIDER || "Apify"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-emerald-400" />
              PostgreSQL:
            </span>
            {dbConnected === null ? (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-pulse" />
            ) : dbConnected ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                Connected
              </span>
            ) : (
              <span className="text-amber-500 font-semibold flex items-center gap-1" title="Falling back to local in-memory storage">
                In-Memory
              </span>
            )}
          </div>
        </div>

        {/* User Login Section */}
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3">
          {status === "loading" ? (
            <div className="h-10 w-full animate-pulse bg-slate-800 rounded-lg" />
          ) : session?.user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <img
                  src={session.user.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                  alt="User Avatar"
                  className="h-8 w-8 rounded-full border border-slate-700/80 object-cover flex-shrink-0"
                />
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-white truncate leading-tight">
                    {session.user.name || "Developer"}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {session.user.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/search" })}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-slate-400 text-center mb-1">
                Sign in to save searches and bookmark jobs
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signIn()}
                className="w-full text-xs gap-1.5 border-slate-700 hover:bg-slate-800 bg-slate-900 text-white cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
