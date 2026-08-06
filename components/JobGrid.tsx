"use client";

import { Job } from "@/types/job";
import { JobCard } from "./JobCard";
import { AnimatePresence } from "framer-motion";

interface JobGridProps {
  jobs: Job[];
  savedJobIds: Set<string>;
  onToggleSave: (job: Job) => void;
}

export function JobGrid({ jobs, savedJobIds, onToggleSave }: JobGridProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isSaved={savedJobIds.has(job.id)}
              onToggleSave={() => onToggleSave(job)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
