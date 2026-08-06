"use client";

import { JobSearchFilters } from "@/types/job";
import { 
  Briefcase, 
  Clock, 
  DollarSign, 
  Building,
  Globe,
  SlidersHorizontal,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface FiltersProps {
  filters: JobSearchFilters;
  onChange: (filters: JobSearchFilters) => void;
  onClear: () => void;
}

export function Filters({ filters, onChange, onClear }: FiltersProps) {
  
  const handleExperienceChange = (val: string | null) => {
    if (!val) return;
    onChange({
      ...filters,
      experience: val === "all" ? undefined : (val as "Entry Level" | "Mid Level" | "Senior"),
    });
  };

  const handleTypeChange = (val: string | null) => {
    if (!val) return;
    onChange({
      ...filters,
      employmentType: val === "all" ? undefined : (val as "Full Time" | "Part Time" | "Internship" | "Contract"),
    });
  };

  const handleRemoteChange = (checked: boolean) => {
    onChange({
      ...filters,
      remote: checked ? true : undefined,
    });
  };

  const handlePostedChange = (val: string | null) => {
    if (!val) return;
    onChange({
      ...filters,
      posted: val === "all" ? undefined : (val as "Today" | "Last 3 Days" | "Last Week" | "Last Month"),
    });
  };

  const handleTextChange = (field: "salary" | "company", value: string) => {
    onChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  return (
    <div className="w-full p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col gap-5 text-slate-200">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm tracking-wider uppercase text-white flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-500" />
          Filter Jobs
        </h3>
        {(filters.experience || filters.employmentType || filters.remote || filters.posted || filters.salary || filters.company) && (
          <button
            onClick={onClear}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <Separator className="bg-slate-800" />

      {/* Experience Level */}
      <div className="flex flex-col gap-2.5">
        <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-slate-500" /> Experience Level
        </Label>
        <Select 
          value={filters.experience || "all"} 
          onValueChange={handleExperienceChange}
        >
          <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs rounded-xl focus:ring-blue-500">
            <SelectValue placeholder="All Experience Levels" />
          </SelectTrigger>
          <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
            <SelectItem value="all" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">All Experience Levels</SelectItem>
            <SelectItem value="Entry Level" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Entry Level</SelectItem>
            <SelectItem value="Mid Level" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Mid Level</SelectItem>
            <SelectItem value="Senior" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Senior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employment Type */}
      <div className="flex flex-col gap-2.5">
        <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-500" /> Employment Type
        </Label>
        <Select 
          value={filters.employmentType || "all"} 
          onValueChange={handleTypeChange}
        >
          <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs rounded-xl">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
            <SelectItem value="all" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">All Types</SelectItem>
            <SelectItem value="Full Time" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Full Time</SelectItem>
            <SelectItem value="Part Time" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Part Time</SelectItem>
            <SelectItem value="Internship" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Internship</SelectItem>
            <SelectItem value="Contract" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Contract</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posted Date */}
      <div className="flex flex-col gap-2.5">
        <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-500" /> Date Posted
        </Label>
        <Select 
          value={filters.posted || "all"} 
          onValueChange={handlePostedChange}
        >
          <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs rounded-xl">
            <SelectValue placeholder="Anytime" />
          </SelectTrigger>
          <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
            <SelectItem value="all" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Anytime</SelectItem>
            <SelectItem value="Today" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Today</SelectItem>
            <SelectItem value="Last 3 Days" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Last 3 Days</SelectItem>
            <SelectItem value="Last Week" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Last Week</SelectItem>
            <SelectItem value="Last Month" className="hover:bg-slate-900 focus:bg-slate-900 cursor-pointer">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Salary Filter */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-slate-500" /> Salary
        </Label>
        <Input
          type="text"
          placeholder="e.g. $80,000"
          value={filters.salary || ""}
          onChange={(e) => handleTextChange("salary", e.target.value)}
          className="bg-slate-950/60 border-slate-800 text-xs rounded-xl focus:ring-blue-500 h-9.5 text-slate-200"
        />
      </div>

      {/* Company Search */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5 text-slate-500" /> Company Name
        </Label>
        <Input
          type="text"
          placeholder="e.g. Google"
          value={filters.company || ""}
          onChange={(e) => handleTextChange("company", e.target.value)}
          className="bg-slate-950/60 border-slate-800 text-xs rounded-xl focus:ring-blue-500 h-9.5 text-slate-200"
        />
      </div>

      <Separator className="bg-slate-800" />

      {/* Remote Toggle */}
      <div className="flex items-center justify-between p-1 bg-slate-950/30 rounded-xl border border-slate-850">
        <Label htmlFor="remote-filter" className="text-xs font-semibold text-slate-300 flex items-center gap-2 cursor-pointer pl-2">
          <Globe className="h-3.5 w-3.5 text-blue-400" /> Remote Roles Only
        </Label>
        <Checkbox
          id="remote-filter"
          checked={!!filters.remote}
          onCheckedChange={handleRemoteChange}
          className="border-slate-700 bg-slate-950 text-blue-500 rounded focus:ring-blue-500/20 mr-2 h-4 w-4"
        />
      </div>
    </div>
  );
}
