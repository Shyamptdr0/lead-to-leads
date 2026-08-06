"use client";

import { Job } from "@/types/job";
import { 
  MapPin, 
  DollarSign, 
  Calendar, 
  Share2, 
  Bookmark, 
  Globe, 
  Building, 
  Briefcase,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";

interface JobCardProps {
  job: Job;
  isSaved: boolean;
  onToggleSave: () => void;
}

export function JobCard({ job, isSaved, onToggleSave }: JobCardProps) {
  
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/jobs/${job.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Job link copied to clipboard!", {
      description: "You can now share it anywhere.",
    });
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSave();
  };

  // Helper to extract company initial for logo placeholder
  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col justify-between w-full p-5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/60 backdrop-blur-sm shadow-lg transition-all duration-300 min-h-[300px]"
    >
      <div>
        {/* Top bar with Logo, Title, and Source */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {job.companyLogo ? (
              <img
                src={job.companyLogo}
                alt={`${job.company} logo`}
                className="h-12 w-12 rounded-xl border border-slate-850 object-contain bg-slate-950 p-1 flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ""; // Clear and trigger fallback initials
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                {getInitials(job.company)}
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <Link href={`/jobs/${job.id}`}>
                <h3 className="font-display font-bold text-base text-white hover:text-blue-400 truncate tracking-wide transition-colors cursor-pointer">
                  {job.title}
                </h3>
              </Link>
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                <Building className="h-3 w-3 text-slate-500" />
                {job.company}
              </span>
            </div>
          </div>
          
          {/* Source badge */}
          <Badge variant="outline" className="text-[10px] border-slate-800 bg-slate-950/80 text-slate-400 font-mono flex items-center gap-1 py-0.5">
            {job.source}
          </Badge>
        </div>

        {/* Location & Salary Info */}
        <div className="flex flex-col gap-2 mt-4 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            <span>{job.location}</span>
          </div>
          {job.salary && (
            <div className="flex items-center gap-2 text-emerald-400">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span>{job.salary}</span>
            </div>
          )}
        </div>

        {/* Job Snippet */}
        {job.description && (
          <p className="text-xs text-slate-500 line-clamp-3 mt-3.5 leading-relaxed">
            {job.description.replace(/<[^>]*>/g, "")}
          </p>
        )}

        {/* Badges / Meta */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {job.remote && (
            <Badge className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded-md">
              Remote
            </Badge>
          )}
          {job.experience && (
            <Badge className="bg-purple-600/10 text-purple-400 border border-purple-500/20 text-[10px] px-2 py-0.5 rounded-md">
              {job.experience}
            </Badge>
          )}
          {job.employmentType && (
            <Badge className="bg-amber-600/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md">
              {job.employmentType}
            </Badge>
          )}
        </div>
      </div>

      <div>
        <hr className="border-slate-800/60 my-4" />

        {/* Bottom Bar: Action buttons */}
        <div className="flex items-center justify-between gap-3 mt-auto">
          {/* Posted Date */}
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <Calendar className="h-3 w-3" />
            <span>{job.postedAt}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 rounded-xl hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Share Job"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>

            {/* Save */}
            <button
              onClick={handleSaveClick}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isSaved
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
              }`}
              title={isSaved ? "Remove Bookmark" : "Save Job"}
            >
              <Bookmark className="h-3.5 w-3.5 fill-current" />
            </button>

            {/* Apply / Details */}
            <Link href={`/jobs/${job.id}`}>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-1.5 px-3.5 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-500/15 cursor-pointer"
              >
                Apply Now
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
