"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { Filters } from "@/components/Filters";
import { JobGrid } from "@/components/JobGrid";
import { JobGridSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { FeaturedCompanies } from "@/components/FeaturedCompanies";
import { Job, JobSearchFilters } from "@/types/job";
import { toast } from "sonner";
import { AlertCircle, RotateCcw, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-8 pb-12 text-slate-200">
        <section className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/10 p-6 md:p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            <Briefcase className="h-3.5 w-3.5 text-blue-400" />
            Job Search Redefined
          </div>
          <h2 className="font-display font-black text-3xl md:text-5xl text-white tracking-tight max-w-2xl leading-none">
            Find Jobs From <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Every Platform</span> In One Search
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl font-medium leading-relaxed">
            Search across LinkedIn, Indeed, Glassdoor, Wellfound, Monster, ZipRecruiter, and more with a single click.
          </p>
        </section>
        <div className="flex flex-col gap-6">
          <div className="h-6 w-48 bg-slate-900 animate-pulse rounded-lg" />
          <JobGridSkeleton count={6} />
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Search parameters state
  const [title, setTitle] = useState("React Developer");
  const [location, setLocation] = useState("San Francisco");
  const [filters, setFilters] = useState<JobSearchFilters>({
    remote: undefined,
    experience: undefined,
    employmentType: undefined,
    posted: undefined,
    salary: undefined,
    company: undefined,
  });

  // Query triggers state (to trigger query only on Search click)
  const [queryParams, setQueryParams] = useState({
    title: "React Developer",
    location: "San Francisco",
    filters: {
      remote: undefined,
      experience: undefined,
      employmentType: undefined,
      posted: undefined,
      salary: undefined,
      company: undefined,
    } as JobSearchFilters,
  });

  // Local storage backup for guest bookmarks
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [localBookmarks, setLocalBookmarks] = useState<Job[]>([]);

  // Sync URL search parameters on load/change
  useEffect(() => {
    const urlTitle = searchParams.get("title");
    const urlLocation = searchParams.get("location");

    if (urlTitle !== null || urlLocation !== null) {
      const newTitle = urlTitle || "React Developer";
      const newLocation = urlLocation || "San Francisco";

      const newFilters: JobSearchFilters = {
        remote: searchParams.get("remote") === "true" ? true : undefined,
        experience: (searchParams.get("experience") as any) || undefined,
        employmentType: (searchParams.get("employmentType") as any) || undefined,
        posted: undefined,
        salary: undefined,
        company: undefined,
      };

      setTitle(newTitle);
      setLocation(newLocation);
      setFilters(newFilters);
      setQueryParams({
        title: newTitle,
        location: newLocation,
        filters: newFilters,
      });
    }
  }, [searchParams]);

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
    }
  }, [dbSavedJobsData, session]);

  // Main search query
  const { data: searchData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["jobs-search", queryParams],
    queryFn: async () => {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryParams),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to search jobs");
      }
      // Log to local storage query history for backup
      logLocalSearchHistory(queryParams.title, queryParams.location, queryParams.filters);
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 mins cache
  });

  const handleSearch = () => {
    setQueryParams({
      title: title.trim(),
      location: location.trim(),
      filters,
    });
  };

  const handleClearFilters = () => {
    const cleared = {
      remote: undefined,
      experience: undefined,
      employmentType: undefined,
      posted: undefined,
      salary: undefined,
      company: undefined,
    };
    setFilters(cleared);
    setQueryParams((prev) => ({
      ...prev,
      filters: cleared,
    }));
  };

  // Helper to log history to localStorage for guest
  const logLocalSearchHistory = (qTitle: string, qLoc: string, qFilters: JobSearchFilters) => {
    const historyItem = {
      id: Math.random().toString(36).substring(7),
      title: qTitle,
      location: qLoc,
      filters: qFilters,
      createdAt: new Date().toISOString(),
    };
    const localHist = localStorage.getItem("jobfinder_history");
    let list = [];
    if (localHist) {
      try {
        list = JSON.parse(localHist);
      } catch (e) {}
    }
    // Prevent duplicate entries
    list = list.filter((item: any) => !(item.title === qTitle && item.location === qLoc));
    list.unshift(historyItem);
    localStorage.setItem("jobfinder_history", JSON.stringify(list.slice(0, 15)));
  };

  // Bookmark Toggle Mutation
  const toggleSaveMutation = useMutation({
    mutationFn: async (job: Job) => {
      const isCurrentlySaved = savedJobIds.has(job.id);
      
      if (session?.user?.id) {
        // Authenticated flow
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
        // Guest localStorage flow
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
      const newIds = new Set(savedJobIds);
      if (data.action === "saved") {
        newIds.add(data.jobId);
        toast.success("Job bookmarked!", {
          description: data.guest ? "Saved in your browser session." : "Synced with your account.",
        });
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

  const jobs = searchData?.jobs || [];

  return (
    <div className="flex flex-col gap-8 pb-12">
      
      {/* Premium Hero section with Glassmorphism */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/10 p-6 md:p-12 text-center flex flex-col items-center justify-center gap-4">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
          <Briefcase className="h-3.5 w-3.5 text-blue-400" />
          Job Search Redefined
        </div>

        <h2 className="font-display font-black text-3xl md:text-5xl text-white tracking-tight max-w-2xl leading-none">
          Find Jobs From <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Every Platform</span> In One Search
        </h2>
        
        <p className="text-slate-400 text-sm md:text-base max-w-xl font-medium leading-relaxed">
          Search across LinkedIn, Indeed, Glassdoor, Wellfound, Monster, ZipRecruiter, and more with a single click.
        </p>
      </section>

      {/* Large Search Input */}
      <SearchBar
        title={title}
        location={location}
        onTitleChange={setTitle}
        onLocationChange={setLocation}
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {/* Main split dashboard view */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left column filters */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <Filters
            filters={filters}
            onChange={setFilters}
            onClear={handleClearFilters}
          />
        </div>

        {/* Right column jobs grid */}
        <div className="flex-grow w-full">
          {isLoading ? (
            <div className="flex flex-col gap-6">
              <div className="h-6 w-48 bg-slate-900 animate-pulse rounded-lg" />
              <JobGridSkeleton count={6} />
            </div>
          ) : isError ? (
            <div className="w-full p-8 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="max-w-md">
                <h4 className="font-display font-semibold text-white">Scraping Search Failed</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {error?.message || "Verify your API configurations inside your .env file."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2 border-rose-500/20 hover:bg-rose-500/10 text-rose-400 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry Request
              </Button>
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState onReset={handleClearFilters} />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing <span className="text-white font-bold">{jobs.length}</span> positions found
                </p>
              </div>
              
              <JobGrid
                jobs={jobs}
                savedJobIds={savedJobIds}
                onToggleSave={(job) => toggleSaveMutation.mutate(job)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Featured logo footer */}
      <FeaturedCompanies />
    </div>
  );
}
