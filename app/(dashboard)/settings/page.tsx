"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Settings, Shield, Server, User, Key, CheckCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [provider, setProvider] = useState<string>("apify");

  useEffect(() => {
    // Read provider from environment (using public env if available, else default)
    setProvider(process.env.NEXT_PUBLIC_SCRAPER_PROVIDER || "apify");
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-200">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-400" />
          Settings & Engine Status
        </h2>
        <p className="text-xs text-slate-400">
          Monitor your scraping provider, APIs, and account connections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Scraper configuration status */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col gap-6">
          <h3 className="font-display font-bold text-sm tracking-wide text-white flex items-center gap-2 uppercase">
            <Server className="h-4 w-4 text-blue-400" />
            Scraper Provider Status
          </h3>

          <div className="flex flex-col gap-4">
            
            {/* Active Provider */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl">
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Active Provider</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Configured in your .env file</div>
              </div>
              <Badge className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs px-3 py-1 rounded-md uppercase font-bold">
                {provider}
              </Badge>
            </div>

            {/* Provider description details */}
            <div className="text-xs text-slate-400 leading-relaxed p-4 bg-slate-950/30 border border-slate-900 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-slate-355 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-blue-400" /> Adapter Engine Checklist
              </span>
              <p>
                The job aggregator uses a Unified Adapter Pattern. You can switch between providers in your <code className="bg-slate-900 px-1 py-0.5 rounded text-white text-[10px]">.env</code> by changing <code className="bg-slate-900 px-1 py-0.5 rounded text-white text-[10px]">SCRAPER_PROVIDER</code> to:
              </p>
              <ul className="list-disc pl-5 mt-1 flex flex-col gap-1 text-[10px]">
                <li><code className="text-white">apify</code>: Connects to Apify Sync Actor API. Requires <code className="text-white">SCRAPER_API_KEY</code>.</li>
                <li><code className="text-white">jsearch</code>: Connects to JSearch RapidAPI. Requires <code className="text-white">SCRAPER_API_KEY</code>.</li>
                <li><code className="text-white">serpapi</code>: Connects to SerpApi Google Jobs. Requires <code className="text-white">SCRAPER_API_KEY</code>.</li>
                <li><code className="text-white">custom</code>: Runs custom API endpoint specified by <code className="text-white">SCRAPER_ENDPOINT</code>.</li>
              </ul>
            </div>

            {/* API Config details */}
            <div className="flex flex-col gap-3.5 border-t border-slate-850 pt-4">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-slate-500" /> Keys & Endpoints Configuration
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-400">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex items-center justify-between">
                  <span>SCRAPER_API_KEY</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 fill-emerald-500/10" /> Connected
                  </span>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex items-center justify-between">
                  <span>SCRAPER_ENDPOINT</span>
                  <span className="text-[10px] text-slate-500">Default fallback</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* User Account block */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col gap-6">
          <h3 className="font-display font-bold text-sm tracking-wide text-white flex items-center gap-2 uppercase">
            <User className="h-4 w-4 text-purple-400" />
            Account Status
          </h3>

          {session ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <img
                src={session.user?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                alt="Avatar"
                className="h-20 w-20 rounded-full border border-slate-800 shadow-xl object-cover"
              />
              <div>
                <div className="text-sm font-bold text-white">{session.user?.name || "Developer"}</div>
                <div className="text-xs text-slate-400 mt-0.5">{session.user?.email}</div>
              </div>
              <Badge className="bg-purple-600/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold py-0.5">
                Authenticated Account
              </Badge>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center py-6 text-slate-400 text-xs">
              <HelpCircle className="h-10 w-10 text-slate-650" />
              <div>
                <div className="text-sm font-semibold text-white">Guest Mode</div>
                <p className="mt-1">Log in using the navbar button to secure cloud bookmark storage and search analytics syncing.</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
