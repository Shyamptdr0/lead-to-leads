"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { 
  Menu, 
  X, 
  Briefcase, 
  Search, 
  Bookmark, 
  History, 
  Settings, 
  Sparkles, 
  LogOut,
  LogIn,
  Activity
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({ searches: 0, bookmarks: 0 });

  // Get active page title
  const getPageTitle = () => {
    switch (pathname) {
      case "/search":
        return "Job Search Engine";
      case "/saved-jobs":
        return "Saved Bookmarks";
      case "/history":
        return "Search Log";
      case "/settings":
        return "Aggregator Settings";
      default:
        return "JobFinder AI";
    }
  };

  // Poll database stats or fallback
  useEffect(() => {
    async function loadStats() {
      try {
        // Fetch saved jobs
        let savedCount = 0;
        if (session) {
          const resSave = await fetch("/api/jobs/save");
          const dataSave = await resSave.json();
          savedCount = dataSave.jobs?.length || 0;
        } else {
          // Check local storage bookmarks
          const localBms = localStorage.getItem("jobfinder_bookmarks");
          if (localBms) savedCount = JSON.parse(localBms).length;
        }

        // Fetch history count
        let historyCount = 0;
        if (session) {
          const resHistory = await fetch("/api/jobs/history");
          const dataHistory = await resHistory.json();
          historyCount = dataHistory.history?.length || 0;
        } else {
          // Check local storage searches
          const localHistory = localStorage.getItem("jobfinder_history");
          if (localHistory) historyCount = JSON.parse(localHistory).length;
        }

        setStats({
          searches: historyCount,
          bookmarks: savedCount
        });
      } catch (e) {
        console.warn("Failed to load navbar stats");
      }
    }

    loadStats();
    // Listen for storage events or query updates
    const interval = setInterval(loadStats, 4000);
    return () => clearInterval(interval);
  }, [session, pathname]);

  return (
    <header className="sticky top-0 z-20 w-full bg-slate-950/60 backdrop-blur-md border-b border-slate-900 flex items-center justify-between px-4 md:px-8 py-3.5 text-slate-200">
      
      {/* Title / Mobile Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 md:hidden hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        
        <h1 className="text-base md:text-lg font-display font-semibold text-white tracking-wide">
          {getPageTitle()}
        </h1>
      </div>

      {/* Analytics stats */}
      <div className="hidden sm:flex items-center gap-6">
        <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/15">
          <Activity className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs text-slate-400">Total Queries:</span>
          <span className="text-xs font-bold text-white">{stats.searches}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/15">
          <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs text-slate-400">Bookmarks:</span>
          <span className="text-xs font-bold text-white">{stats.bookmarks}</span>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-slate-950 border-b border-slate-900 p-4 shadow-2xl flex flex-col gap-3 md:hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
            Navigation
          </div>
          
          <Link href="/search" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 text-slate-300">
              <Search className="h-4 w-4 text-blue-400" /> Search Jobs
            </div>
          </Link>
          <Link href="/saved-jobs" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 text-slate-300">
              <Bookmark className="h-4 w-4 text-emerald-400" /> Saved Bookmarks
            </div>
          </Link>
          <Link href="/history" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 text-slate-300">
              <History className="h-4 w-4 text-purple-400" /> Search Log
            </div>
          </Link>
          <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 text-slate-300">
              <Settings className="h-4 w-4 text-slate-400" /> Settings
            </div>
          </Link>

          <hr className="border-slate-905 my-1" />

          {/* Project switch */}
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
              <Sparkles className="h-4 w-4" /> Go to LeadExtractor
            </div>
          </Link>

          {/* Session controls */}
          {session ? (
            <div className="flex items-center justify-between p-2 mt-2 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <img src={session.user?.image || ""} className="h-7 w-7 rounded-full object-cover" alt="" />
                <span className="text-xs text-white font-medium">{session.user?.name}</span>
              </div>
              <button 
                onClick={() => { signOut(); setMobileMenuOpen(false); }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          ) : (
            <Button 
              onClick={() => { signIn(); setMobileMenuOpen(false); }}
              size="sm" 
              className="w-full mt-2 cursor-pointer"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
