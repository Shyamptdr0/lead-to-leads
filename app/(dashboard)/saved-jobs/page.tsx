"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { JobGrid } from "@/components/JobGrid";
import { JobGridSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Job } from "@/types/job";
import { Bookmark, Lock } from "lucide-react";
import { toast } from "sonner";

export default function SavedJobsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Local storage bookmarks for guests
  const [localBookmarks, setLocalBookmarks] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  // Load guest bookmarks on mount
  useEffect(() => {
    const local = localStorage.getItem("jobfinder_bookmarks");
    if (local) {
      try {
        const parsed = JSON.parse(local) as Job[];
        setLocalBookmarks(parsed);
        setSavedJobIds(new Set(parsed.map((j) => j.id)));
      } catch (e) {
        console.error("Failed to parse local bookmarks");
      }
    }
  }, []);

  // Fetch database saved jobs if logged in
  const { data: dbData, isLoading: isDbLoading } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/save");
      if (!res.ok) throw new Error("Failed to load saved jobs");
      return res.json();
    },
    enabled: !!session?.user?.id,
  });

  // Keep savedJobIds in sync
  useEffect(() => {
    if (session?.user?.id && dbData?.success) {
      const dbJobs = dbData.jobs || [];
      setSavedJobIds(new Set(dbJobs.map((j: any) => j.jobId || j.id)));
    }
  }, [dbData, session]);

  // Remove Bookmark Mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (session?.user?.id) {
        const res = await fetch(`/api/jobs/save?jobId=${jobId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete bookmark");
        return { jobId };
      } else {
        const filtered = localBookmarks.filter((j) => j.id !== jobId);
        localStorage.setItem("jobfinder_bookmarks", JSON.stringify(filtered));
        setLocalBookmarks(filtered);
        return { jobId, guest: true };
      }
    },
    onSuccess: (data) => {
      const updated = new Set(savedJobIds);
      updated.delete(data.jobId);
      setSavedJobIds(updated);
      toast.success("Bookmark removed");
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove bookmark");
    },
  });

  // Get active list of jobs to render
  const getJobsToRender = (): Job[] => {
    if (session?.user?.id) {
      const dbJobs = dbData?.jobs || [];
      return dbJobs.map((j: any) => ({
        id: j.jobId || j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        salary: j.salary || undefined,
        experience: j.experience || undefined,
        employmentType: j.employmentType || undefined,
        remote: j.remote,
        postedAt: j.postedAt || undefined,
        description: j.description || undefined,
        skills: j.skills || [],
        jobUrl: j.jobUrl,
        companyLogo: j.companyLogo || undefined,
        source: j.source,
      }));
    }
    return localBookmarks;
  };

  const activeJobs = getJobsToRender();
  const isLoading = session?.user?.id ? isDbLoading : false;

  return (
    <div className="flex flex-col gap-6 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-emerald-400 fill-emerald-500/10" />
          My Bookmarked Jobs
        </h2>
        <p className="text-xs text-slate-400">
          {session 
            ? "Your bookmarks are synced across all your devices."
            : "Bookmarks are stored locally in your browser. Log in to sync them globally."}
        </p>
      </div>

      {/* Guest Lock warning */}
      {!session && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-amber-500 text-xs font-medium">
          <Lock className="h-4 w-4 flex-shrink-0" />
          You are currently in guest mode. Log in to save these bookmarks to your account permanently.
        </div>
      )}

      {/* Jobs grid view */}
      {isLoading ? (
        <JobGridSkeleton count={3} />
      ) : activeJobs.length === 0 ? (
        <EmptyState 
          title="No Bookmarks Yet" 
          description="Click the bookmark icon on any job card to save listings here for easy reference."
        />
      ) : (
        <JobGrid
          jobs={activeJobs}
          savedJobIds={savedJobIds}
          onToggleSave={(job) => removeBookmarkMutation.mutate(job.id)}
        />
      )}
    </div>
  );
}
