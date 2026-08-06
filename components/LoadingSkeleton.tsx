import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton() {
  return (
    <div className="w-full p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm flex flex-col gap-4 animate-pulse">
      {/* Top Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl bg-slate-800" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40 bg-slate-800" />
            <Skeleton className="h-4 w-28 bg-slate-800" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded bg-slate-800" />
      </div>

      {/* Description lines */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full bg-slate-800" />
        <Skeleton className="h-4 w-3/4 bg-slate-800" />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Skeleton className="h-5 w-20 rounded bg-slate-800" />
        <Skeleton className="h-5 w-24 rounded bg-slate-800" />
        <Skeleton className="h-5 w-16 rounded bg-slate-800" />
      </div>

      <hr className="border-slate-800/60 my-1" />

      {/* Bottom section */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <Skeleton className="h-4 w-24 bg-slate-800" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg bg-slate-800" />
          <Skeleton className="h-8.5 w-24 rounded-xl bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function JobGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function JobDetailsSkeleton() {
  return (
    <div className="w-full bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-6 animate-pulse">
      <div className="flex flex-col md:flex-row justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl bg-slate-800" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48 bg-slate-800" />
            <Skeleton className="h-5 w-32 bg-slate-800" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg bg-slate-800" />
          <Skeleton className="h-11 w-32 rounded-xl bg-slate-800" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-slate-800" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32 bg-slate-800" />
        <Skeleton className="h-4 w-full bg-slate-800" />
        <Skeleton className="h-4 w-full bg-slate-800" />
        <Skeleton className="h-4 w-2/3 bg-slate-800" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32 bg-slate-800" />
        <Skeleton className="h-4 w-full bg-slate-800" />
        <Skeleton className="h-4 w-full bg-slate-800" />
      </div>
    </div>
  );
}
