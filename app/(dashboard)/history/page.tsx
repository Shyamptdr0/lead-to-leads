"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { History, Trash2, Calendar, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  id: string;
  title: string;
  location: string;
  filters?: any;
  createdAt: string;
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([]);

  // Load guest history
  useEffect(() => {
    const local = localStorage.getItem("jobfinder_history");
    if (local) {
      try {
        setLocalHistory(JSON.parse(local));
      } catch (e) {
        console.error("Failed to parse local history");
      }
    }
  }, []);

  // Fetch db history if authenticated
  const { data: dbData, isLoading: isDbLoading } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/history");
      if (!res.ok) throw new Error("Failed to load search history");
      return res.json();
    },
    enabled: !!session?.user?.id,
  });

  // Clear history mutation
  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      if (session?.user?.id) {
        const res = await fetch("/api/jobs/history", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to clear search history");
        return { success: true };
      } else {
        localStorage.removeItem("jobfinder_history");
        setLocalHistory([]);
        return { success: true, guest: true };
      }
    },
    onSuccess: () => {
      toast.success("Search history cleared");
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to clear search history");
    },
  });

  const getHistoryList = (): HistoryItem[] => {
    if (session?.user?.id) {
      return dbData?.history || [];
    }
    return localHistory;
  };

  const history = getHistoryList();
  const isLoading = session?.user?.id ? isDbLoading : false;

  const handleReSearch = (item: HistoryItem) => {
    // Navigate back to search page and trigger search
    // We can pass parameters as searchParams
    const searchParams = new URLSearchParams();
    searchParams.set("title", item.title);
    searchParams.set("location", item.location);
    if (item.filters?.remote) searchParams.set("remote", "true");
    if (item.filters?.experience) searchParams.set("experience", item.filters.experience);
    if (item.filters?.employmentType) searchParams.set("employmentType", item.filters.employmentType);

    router.push(`/search?${searchParams.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-purple-400" />
            Recent Searches
          </h2>
          <p className="text-xs text-slate-400">
            Click on any search term to run the query again.
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearHistoryMutation.mutate()}
            className="text-xs gap-1.5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10 cursor-pointer bg-slate-900"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Log
          </Button>
        )}
      </div>

      {/* History List */}
      {isLoading ? (
        <div className="flex flex-col gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full bg-slate-900 rounded-xl border border-slate-800" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-slate-900/20 border border-slate-800/85 text-slate-400 gap-3">
          <History className="h-10 w-10 text-slate-600" />
          <div>
            <div className="text-sm font-semibold text-white">No search history</div>
            <div className="text-xs mt-1">Queries you search for will appear here.</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleReSearch(item)}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-850 hover:border-slate-700/80 cursor-pointer transition-all duration-200 gap-3 text-slate-200"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1.5 font-medium">
                    <MapPin className="h-3 w-3 text-slate-500" />
                    {item.location}
                    {item.filters?.remote && (
                      <Badge className="bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[9px] py-0 px-1 rounded">
                        Remote
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Time and details */}
              <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
