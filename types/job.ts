export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  experience?: "Entry Level" | "Mid Level" | "Senior";
  employmentType?: "Full Time" | "Part Time" | "Internship" | "Contract";
  remote?: boolean;
  postedAt?: string;
  description?: string;
  skills?: string[];
  jobUrl: string;
  companyLogo?: string;
  source: string; // e.g. "LinkedIn", "Indeed", "Glassdoor"
}

export interface JobSearchFilters {
  experience?: "Entry Level" | "Mid Level" | "Senior";
  employmentType?: "Full Time" | "Part Time" | "Internship" | "Contract";
  remote?: boolean;
  posted?: "Today" | "Last 3 Days" | "Last Week" | "Last Month";
  salary?: string;
  company?: string;
}

export interface JobSearchParams {
  title: string;
  location: string;
  filters?: JobSearchFilters;
}

export interface SearchHistoryItem {
  id: string;
  title: string;
  location: string;
  filters?: JobSearchFilters;
  createdAt: string;
}

export interface SavedJobItem extends Job {
  savedAt: string;
}

export interface ScraperStatus {
  provider: string;
  configured: boolean;
  endpoint: string;
}
