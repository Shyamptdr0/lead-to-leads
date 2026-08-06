"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building, 
  MapPin, 
  DollarSign, 
  Calendar, 
  ArrowLeft, 
  Bookmark, 
  Globe, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Award,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { JobDetailsSkeleton } from "@/components/LoadingSkeleton";
import { Job } from "@/types/job";

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const id = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [localBookmarks, setLocalBookmarks] = useState<Job[]>([]);

  // Load job from cache or local storage on mount
  useEffect(() => {
    // 1. Check local bookmarks first
    const local = localStorage.getItem("jobfinder_bookmarks");
    let bookmarksList: Job[] = [];
    if (local) {
      try {
        bookmarksList = JSON.parse(local);
        setLocalBookmarks(bookmarksList);
        setSavedJobIds(new Set(bookmarksList.map((j) => j.id)));
      } catch (e) {}
    }

    // 2. Try to find job details
    // Check local storage for active job details cache
    const cachedJobStr = localStorage.getItem(`jobfinder_active_job_${id}`);
    if (cachedJobStr) {
      try {
        setJob(JSON.parse(cachedJobStr));
        return;
      } catch (e) {}
    }

    // 3. Fallback: Search the react query cache for matching job
    const searchQueries = queryClient.getQueriesData({ queryKey: ["jobs-search"] });
    for (const [key, data] of searchQueries) {
      if (data && (data as any).jobs) {
        const found = (data as any).jobs.find((j: Job) => j.id === id);
        if (found) {
          setJob(found);
          // Cache in local storage for refresh resiliency
          localStorage.setItem(`jobfinder_active_job_${id}`, JSON.stringify(found));
          return;
        }
      }
    }
  }, [id, queryClient]);

  // Fetch db saved jobs if authenticated
  const { data: dbSavedJobsData } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/save");
      if (!res.ok) throw new Error("Failed to fetch saved jobs");
      return res.json();
    },
    enabled: !!session?.user?.id,
  });

  // Sync DB bookmarks with active UI set
  useEffect(() => {
    if (session?.user?.id && dbSavedJobsData?.success) {
      const dbJobs = dbSavedJobsData.jobs || [];
      setSavedJobIds(new Set(dbJobs.map((j: any) => j.jobId || j.id)));
      
      // If we still don't have job info, try finding it in saved jobs list
      if (!job) {
        const match = dbJobs.find((j: any) => (j.jobId || j.id) === id);
        if (match) {
          setJob({
            id: match.jobId || match.id,
            title: match.title,
            company: match.company,
            location: match.location,
            salary: match.salary || undefined,
            experience: match.experience || undefined,
            employmentType: match.employmentType || undefined,
            remote: match.remote,
            postedAt: match.postedAt || undefined,
            description: match.description || undefined,
            skills: match.skills || [],
            jobUrl: match.jobUrl,
            companyLogo: match.companyLogo || undefined,
            source: match.source,
          });
        }
      }
    }
  }, [dbSavedJobsData, session, id, job]);

  // Bookmark Toggle Mutation
  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (!job) return;
      const isCurrentlySaved = savedJobIds.has(job.id);
      
      if (session?.user?.id) {
        if (isCurrentlySaved) {
          const res = await fetch(`/api/jobs/save?jobId=${job.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete bookmark");
          return { jobId: job.id, action: "removed" };
        } else {
          const res = await fetch("/api/jobs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(job),
          });
          if (!res.ok) throw new Error("Failed to save bookmark");
          return { jobId: job.id, action: "saved" };
        }
      } else {
        let newList = [...localBookmarks];
        if (isCurrentlySaved) {
          newList = newList.filter((j) => j.id !== job.id);
          localStorage.setItem("jobfinder_bookmarks", JSON.stringify(newList));
          setLocalBookmarks(newList);
          return { jobId: job.id, action: "removed", guest: true };
        } else {
          const newJob = { ...job, savedAt: new Date().toISOString() };
          newList.unshift(newJob);
          localStorage.setItem("jobfinder_bookmarks", JSON.stringify(newList));
          setLocalBookmarks(newList);
          return { jobId: job.id, action: "saved", guest: true };
        }
      }
    },
    onSuccess: (data) => {
      if (!data) return;
      const newIds = new Set(savedJobIds);
      if (data.action === "saved") {
        newIds.add(data.jobId);
        toast.success("Job bookmarked!");
      } else {
        newIds.delete(data.jobId);
        toast.success("Bookmark removed.");
      }
      setSavedJobIds(newIds);
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to toggle bookmark");
    },
  });

  if (!job) {
    return (
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="self-start gap-1.5 text-slate-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <JobDetailsSkeleton />
      </div>
    );
  }

  const isSaved = savedJobIds.has(job.id);

  // Parse HTML/Text description for sections
  const getParagraphs = (text: string) => {
    return text.split("\n\n").filter(Boolean);
  };

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-200">
      
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="self-start gap-1.5 text-slate-400 hover:text-white cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Button>

      {/* Main Glassmorphic Job Card Details */}
      <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl flex flex-col gap-8 relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row justify-between gap-6 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            {job.companyLogo ? (
              <img
                src={job.companyLogo}
                alt={`${job.company} logo`}
                className="h-16 w-16 rounded-2xl border border-slate-800 object-contain bg-slate-950 p-2 flex-shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-2xl flex-shrink-0">
                {job.company.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-display font-black text-white leading-tight">
                {job.title}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 text-slate-400 text-sm font-semibold">
                <Building className="h-4 w-4 text-slate-500" />
                <span>{job.company}</span>
                <span className="text-slate-600">•</span>
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] py-0 px-2">
                  {job.source}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Save */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => toggleSaveMutation.mutate()}
              className={`rounded-xl border h-11 w-11 cursor-pointer ${
                isSaved
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 bg-slate-950/40"
              }`}
              title={isSaved ? "Remove Bookmark" : "Save Job"}
            >
              <Bookmark className="h-4 w-4 fill-current" />
            </Button>

            {/* Apply */}
            <a href={job.jobUrl} target="_blank" rel="noopener noreferrer">
              <Button className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 rounded-xl shadow-lg shadow-blue-500/15 flex items-center gap-1.5 cursor-pointer">
                Apply on Source
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        {/* Metabar Grid info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Location</span>
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-400" />
              {job.location}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Salary Range</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              {job.salary || "Not Specified"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Experience Level</span>
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-purple-400" />
              {job.experience || "All Experience"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Posted At</span>
            <span className="text-xs font-semibold text-slate-350 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {job.postedAt}
            </span>
          </div>
        </div>

        {/* Job Description details */}
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-300">
          
          {/* Key Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Key Skills & Technologies
              </h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {job.skills.map((skill) => (
                  <Badge key={skill} className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs px-2.5 py-1 rounded-md font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description Section */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display font-bold text-sm text-white tracking-wide border-l-2 border-blue-500 pl-2">
              Job Description
            </h3>
            <div className="flex flex-col gap-3 font-medium text-slate-350 pl-2">
              {getParagraphs(job.description || "").map((p, idx) => (
                <p key={idx}>{p.replace(/<[^>]*>/g, "")}</p>
              ))}
              {!job.description && (
                <p className="text-slate-500 italic">No description provided. Click the &apos;Apply on Source&apos; button to read the details on the original platform.</p>
              )}
            </div>
          </div>

          {/* Security / Verification */}
          <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl mt-6">
            <ShieldCheck className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div className="text-xs text-slate-400 font-medium">
              This job is scraped directly from <span className="text-white font-semibold">{job.source}</span>. Antigravity verifies safety but encourages reviewing original details.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
