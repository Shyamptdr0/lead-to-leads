"use client";

import React from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  title: string;
  location: string;
  onTitleChange: (val: string) => void;
  onLocationChange: (val: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

export function SearchBar({
  title,
  location,
  onTitleChange,
  onLocationChange,
  onSearch,
  isLoading = false,
}: SearchBarProps) {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && title.trim() && location.trim()) {
      onSearch();
    }
  };

  const isSearchDisabled = !title.trim() || !location.trim() || isLoading;

  return (
    <div className="w-full rounded-2xl bg-slate-900/40 border border-slate-800/80 p-3 md:p-4 backdrop-blur-md shadow-xl flex flex-col md:flex-row gap-3 md:gap-4 items-center">
      {/* Title Search Input */}
      <div className="flex-1 w-full flex items-center gap-2.5 px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-850 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
        <Search className="h-4.5 w-4.5 text-slate-500 flex-shrink-0" />
        <Input
          type="text"
          placeholder="Job title, keywords, or company..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-0 bg-transparent text-sm h-10 w-full focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-slate-500 text-slate-100"
        />
      </div>

      {/* Location Search Input */}
      <div className="flex-1 w-full flex items-center gap-2.5 px-3 py-1 bg-slate-950/60 rounded-xl border border-slate-850 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
        <MapPin className="h-4.5 w-4.5 text-slate-500 flex-shrink-0" />
        <Input
          type="text"
          placeholder="City, state, or remote..."
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-0 bg-transparent text-sm h-10 w-full focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-slate-500 text-slate-100"
        />
      </div>

      {/* Search Button */}
      <Button
        onClick={onSearch}
        disabled={isSearchDisabled}
        className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 rounded-xl shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            Searching
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-white" />
            Find Jobs
          </>
        )}
      </Button>
    </div>
  );
}
