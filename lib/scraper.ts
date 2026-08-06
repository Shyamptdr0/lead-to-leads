import axios from "axios";
import { Job, JobSearchParams, JobSearchFilters } from "../types/job";

export interface JobScraperProvider {
  searchJobs(params: JobSearchParams): Promise<Job[]>;
}

// Helper to calculate mock ID when provider doesn't supply a unique one
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Helper to detect if a key is a placeholder
function isPlaceholder(key: string | undefined): boolean {
  if (!key) return true;
  const k = key.toLowerCase();
  return k.includes("your_") || k.includes("placeholder") || k.includes("key_here");
}

// 1. Apify Provider
export class ApifyProvider implements JobScraperProvider {
  async searchJobs(params: JobSearchParams): Promise<Job[]> {
    const apiKey = !isPlaceholder(process.env.APIFY_TOKEN)
      ? process.env.APIFY_TOKEN
      : (!isPlaceholder(process.env.SCRAPER_API_KEY) ? process.env.SCRAPER_API_KEY : undefined);

    if (!apiKey) {
      throw new Error("Apify API key is missing or invalid placeholder. Please configure APIFY_TOKEN in your .env file.");
    }

    const actor = process.env.APIFY_JOBS_ACTOR || "johnvc~Google-Jobs-Scraper";
    const endpoint =
      process.env.APIFY_ENDPOINT ||
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`;

    const query = `${params.title} in ${params.location}`;
    
    const countryCode = this.detectCountryCode(params.location);
    const countryNameMap: Record<string, string> = {
      in: "india",
      gb: "uk",
      ca: "canada",
      us: "usa"
    };
    const countryName = countryCode ? countryNameMap[countryCode] : "all";

    let jobType: string | undefined;
    if (params.filters?.employmentType) {
      const type = params.filters.employmentType.toLowerCase();
      if (type.includes("full")) jobType = "FULLTIME";
      else if (type.includes("part")) jobType = "PARTTIME";
      else if (type.includes("contract")) jobType = "CONTRACTOR";
      else if (type.includes("intern")) jobType = "INTERN";
    }

    let datePosted: string | undefined;
    if (params.filters?.posted) {
      const posted = params.filters.posted.toLowerCase();
      if (posted.includes("today")) datePosted = "today";
      else if (posted.includes("3 days")) datePosted = "3days";
      else if (posted.includes("week")) datePosted = "week";
      else if (posted.includes("month")) datePosted = "month";
    }

    // Construct request options
    // Apify Google Jobs scraper input schema (robust payload supporting multiple actors)
    const payload = {
      // General keywords (supports both merged query and separate query/location format)
      query: params.title,
      queries: [params.title], // johnvc expects array of titles
      searchQueries: [params.title],
      includeKeyword: params.title, // johnvc requires includeKeyword
      
      // Location parameters
      locationName: params.location, // johnvc expects locationName
      location: params.location,
      
      // Fallback merged query if the scraper only takes a single search string
      searchStringsArray: [query],
      
      // Limits and pagination
      maxItems: 20,
      maxResultsPerQuery: 20,
      pagesToFetch: 1, // johnvc pagination limit
      
      // Language / Country
      language: "en",
      languageCode: "en",
      countryCode: countryCode,
      countryName: countryName, // johnvc expects countryName
      
      // Filters for johnvc
      ...(jobType ? { jobType } : {}),
      ...(datePosted ? { datePosted } : {}),
      
      // Proxy Configuration (Required to prevent Google from blocking the scraper)
      proxyConfiguration: {
        useApifyProxy: true
      }
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        params: {
          token: apiKey, // Some Apify endpoints take token in query
        },
        timeout: 90000, // 90 seconds (Apify synchronous runs can take time)
      });

      console.log(`[Apify Scraper] Response status: ${response.status}`);
      console.log(`[Apify Scraper] Is array: ${Array.isArray(response.data)}. Type: ${typeof response.data}`);
      if (!Array.isArray(response.data)) {
        console.log(`[Apify Scraper] Non-array response sample:`, JSON.stringify(response.data).substring(0, 400));
      } else {
        console.log(`[Apify Scraper] Returned ${response.data.length} raw items.`);
      }

      const items = Array.isArray(response.data) ? response.data : response.data.items || [];
      
      // Normalize
      return items.map((item: any) => {
        const jobId = item.job_id || item.id || item.jobId || hashString((item.title || "") + (item.company || item.company_name || "") + (item.jobUrl || item.share_link || ""));
        const jobUrl = item.jobUrl || item.applyLink || item.share_link || (Array.isArray(item.apply_options) && item.apply_options[0]?.apply_link) || "#";
        return {
          id: `apify-${jobId}`,
          title: item.title || params.title,
          company: item.company || item.company_name || item.companyName || "Unknown Company",
          location: item.location || params.location,
          salary: item.salary || item.salary_range || undefined,
          experience: this.mapExperience(item.description || ""),
          employmentType: this.mapEmploymentType(item.scheduleType || item.employmentType || item.detected_extensions?.schedule_type || ""),
          remote: this.checkRemote(item.location || "", item.title || "", item.description || ""),
          postedAt: item.postedAt || item.detected_extensions?.posted_at || "Recently",
          description: item.description || "",
          skills: item.skills || this.extractSkills(item.description || ""),
          jobUrl: jobUrl,
          companyLogo: item.thumbnail || item.companyLogo || item.company_logo || undefined,
          source: item.source || "Apify Scraper",
        };
      });
    } catch (error: any) {
      console.error("Apify Scraper Error Details:", error);
      const errMsg = error.response?.data?.error?.message || 
                     error.response?.data?.message || 
                     error.message || 
                     String(error);
      throw new Error(`Apify Scraper failed: ${errMsg}`);
    }
  }

  private detectCountryCode(location: string): string | undefined {
    const loc = location.toLowerCase();
    if (loc.includes("india") || loc.includes("mumbai") || loc.includes("delhi") || loc.includes("bangalore") || loc.includes("pune") || loc.includes("bandra") || loc.includes("andheri")) {
      return "in";
    }
    if (loc.includes("uk") || loc.includes("london") || loc.includes("united kingdom")) {
      return "gb";
    }
    if (loc.includes("canada") || loc.includes("toronto")) {
      return "ca";
    }
    if (loc.includes("us") || loc.includes("usa") || loc.includes("sf") || loc.includes("san francisco") || loc.includes("new york") || loc.includes("california")) {
      return "us";
    }
    return undefined;
  }

  private mapExperience(desc: string): "Entry Level" | "Mid Level" | "Senior" | undefined {
    const d = desc.toLowerCase();
    if (d.includes("senior") || d.includes("lead") || d.includes("sr.")) return "Senior";
    if (d.includes("junior") || d.includes("entry") || d.includes("intern") || d.includes("fresher")) return "Entry Level";
    return "Mid Level";
  }

  private mapEmploymentType(type: string): "Full Time" | "Part Time" | "Internship" | "Contract" | undefined {
    const t = type.toLowerCase();
    if (t.includes("full-time") || t.includes("fulltime") || t.includes("permanent")) return "Full Time";
    if (t.includes("part-time") || t.includes("parttime")) return "Part Time";
    if (t.includes("contract") || t.includes("temp")) return "Contract";
    if (t.includes("intern") || t.includes("apprenticeship")) return "Internship";
    return undefined;
  }

  private checkRemote(loc: string, title: string, desc: string): boolean {
    const content = `${loc} ${title} ${desc}`.toLowerCase();
    return content.includes("remote") || content.includes("work from home") || content.includes("wfh");
  }

  private extractSkills(desc: string): string[] {
    const commonSkills = [
      "React", "Node", "TypeScript", "JavaScript", "Python", "Java", "C++", 
      "Go", "Next.js", "Tailwind", "SQL", "PostgreSQL", "MongoDB", "Docker", 
      "AWS", "Kubernetes", "Git", "HTML", "CSS", "Prisma", "Next.js"
    ];
    return commonSkills.filter(skill => {
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapedSkill}\\b`, "i").test(desc);
    });
  }
}

// 2. JSearch Provider (RapidAPI JSearch)
export class JSearchProvider implements JobScraperProvider {
  async searchJobs(params: JobSearchParams): Promise<Job[]> {
    const apiKey = !isPlaceholder(process.env.JSEARCH_API_KEY)
      ? process.env.JSEARCH_API_KEY
      : (!isPlaceholder(process.env.SCRAPER_API_KEY) ? process.env.SCRAPER_API_KEY : undefined);

    if (!apiKey) {
      throw new Error("JSearch API Key is missing or invalid placeholder. Please configure JSEARCH_API_KEY or SCRAPER_API_KEY in your .env file.");
    }

    const endpoint = process.env.JSEARCH_ENDPOINT || "https://jsearch.p.rapidapi.com/search";
    const query = `${params.title} in ${params.location}`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "jsearch.p.rapidapi.com",
        },
        params: {
          query,
          page: "1",
          num_pages: "1",
        },
        timeout: 10000,
      });

      const data = response.data.data || [];

      return data.map((item: any) => {
        const salaryText = item.job_min_salary && item.job_max_salary 
          ? `$${item.job_min_salary} - $${item.job_max_salary} ${item.job_salary_currency || "USD"}`
          : undefined;

        return {
          id: `jsearch-${item.job_id}`,
          title: item.job_title,
          company: item.employer_name || "Unknown Company",
          location: `${item.job_city || ""}, ${item.job_state || ""} ${item.job_country || ""}`.trim() || params.location,
          salary: salaryText,
          experience: this.mapExperience(item.job_required_experience),
          employmentType: this.mapEmploymentType(item.job_employment_type),
          remote: item.job_is_remote || false,
          postedAt: item.job_posted_at_datetime_utc 
            ? new Date(item.job_posted_at_datetime_utc).toLocaleDateString()
            : "Recently",
          description: item.job_description || "",
          skills: item.job_required_skills || [],
          jobUrl: item.job_apply_link || "#",
          companyLogo: item.employer_logo || undefined,
          source: item.job_publisher || "JSearch API",
        };
      });
    } catch (error: any) {
      console.error("JSearch Scraper Error:", error.message);
      throw new Error(`JSearch Scraper failed: ${error.message}`);
    }
  }

  private mapExperience(exp: any): "Entry Level" | "Mid Level" | "Senior" | undefined {
    if (!exp) return undefined;
    const requiredYears = exp.required_experience_in_months / 12;
    if (requiredYears >= 5) return "Senior";
    if (requiredYears >= 2) return "Mid Level";
    return "Entry Level";
  }

  private mapEmploymentType(type: string): "Full Time" | "Part Time" | "Internship" | "Contract" | undefined {
    if (!type) return undefined;
    const t = type.toUpperCase();
    if (t === "FULLTIME") return "Full Time";
    if (t === "PARTTIME") return "Part Time";
    if (t === "CONTRACTOR" || t === "CONTRACT") return "Contract";
    if (t === "INTERN") return "Internship";
    return undefined;
  }
}

// 3. SerpApi Provider (Google Jobs Search via SerpApi)
export class SerpApiProvider implements JobScraperProvider {
  async searchJobs(params: JobSearchParams): Promise<Job[]> {
    const apiKey = !isPlaceholder(process.env.SERPAPI_API_KEY)
      ? process.env.SERPAPI_API_KEY
      : (!isPlaceholder(process.env.SCRAPER_API_KEY) ? process.env.SCRAPER_API_KEY : undefined);

    if (!apiKey) {
      throw new Error("SerpApi Key is missing or invalid placeholder. Please configure SERPAPI_API_KEY or SCRAPER_API_KEY in your .env file.");
    }

    const endpoint = process.env.SERPAPI_ENDPOINT || "https://serpapi.com/search.json";
    const query = `${params.title} ${params.location}`;

    try {
      const response = await axios.get(endpoint, {
        params: {
          engine: "google_jobs",
          q: query,
          api_key: apiKey,
        },
        timeout: 10000,
      });

      const jobs = response.data.jobs_results || [];

      return jobs.map((item: any) => {
        const jobId = item.job_id || hashString(item.title + item.company_name + (item.description || ""));
        return {
          id: `serpapi-${jobId}`,
          title: item.title,
          company: item.company_name || "Unknown Company",
          location: item.location || params.location,
          salary: item.salary || undefined,
          experience: this.mapExperience(item.description || ""),
          employmentType: this.mapEmploymentType(item.detected_extensions?.schedule_type || ""),
          remote: this.checkRemote(item.location || "", item.title || "", item.description || ""),
          postedAt: item.detected_extensions?.posted_at || "Recently",
          description: item.description || "",
          skills: this.extractSkills(item.description || ""),
          jobUrl: item.share_link || "#",
          companyLogo: item.thumbnail || undefined,
          source: item.via || "Google Jobs via SerpApi",
        };
      });
    } catch (error: any) {
      console.error("SerpApi Scraper Error:", error.message);
      throw new Error(`SerpApi Scraper failed: ${error.message}`);
    }
  }

  private mapExperience(desc: string): "Entry Level" | "Mid Level" | "Senior" | undefined {
    const d = desc.toLowerCase();
    if (d.includes("senior") || d.includes("lead") || d.includes("sr.")) return "Senior";
    if (d.includes("junior") || d.includes("entry") || d.includes("intern") || d.includes("fresher")) return "Entry Level";
    return "Mid Level";
  }

  private mapEmploymentType(type: string): "Full Time" | "Part Time" | "Internship" | "Contract" | undefined {
    const t = type.toLowerCase();
    if (t.includes("full-time") || t.includes("full time")) return "Full Time";
    if (t.includes("part-time") || t.includes("part time")) return "Part Time";
    if (t.includes("contract")) return "Contract";
    if (t.includes("intern")) return "Internship";
    return undefined;
  }

  private checkRemote(loc: string, title: string, desc: string): boolean {
    const content = `${loc} ${title} ${desc}`.toLowerCase();
    return content.includes("remote") || content.includes("work from home") || content.includes("wfh");
  }

  private extractSkills(desc: string): string[] {
    const commonSkills = [
      "React", "Node", "TypeScript", "JavaScript", "Python", "Java", "C++", 
      "Go", "Next.js", "Tailwind", "SQL", "PostgreSQL", "MongoDB", "Docker", 
      "AWS", "Kubernetes", "Git", "HTML", "CSS", "Prisma"
    ];
    return commonSkills.filter(skill => {
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapedSkill}\\b`, "i").test(desc);
    });
  }
}

// 4. Custom Scraper Provider
export class CustomProvider implements JobScraperProvider {
  async searchJobs(params: JobSearchParams): Promise<Job[]> {
    const apiKey = !isPlaceholder(process.env.CUSTOM_API_KEY)
      ? process.env.CUSTOM_API_KEY
      : (!isPlaceholder(process.env.SCRAPER_API_KEY) ? process.env.SCRAPER_API_KEY : undefined);
    const endpoint = process.env.SCRAPER_ENDPOINT;

    if (!endpoint) {
      throw new Error("Custom Scraper endpoint is missing. Set SCRAPER_ENDPOINT in .env");
    }

    try {
      const response = await axios.post(endpoint, params, {
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        timeout: 45000,
      });

      // Custom endpoint must return normalized job list
      const jobs = Array.isArray(response.data) 
        ? response.data 
        : response.data.jobs || response.data.data || [];

      return jobs.map((item: any) => ({
        id: item.id || `custom-${hashString(item.title + item.company + item.jobUrl)}`,
        title: item.title,
        company: item.company,
        location: item.location,
        salary: item.salary,
        experience: item.experience,
        employmentType: item.employmentType,
        remote: item.remote || false,
        postedAt: item.postedAt || "Recently",
        description: item.description || "",
        skills: item.skills || [],
        jobUrl: item.jobUrl,
        companyLogo: item.companyLogo,
        source: item.source || "Custom API",
      }));
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 
                     error.response?.data?.detail || 
                     (typeof error.response?.data === 'string' ? error.response.data : null) ||
                     error.message;
      console.error("Custom Scraper Error:", errMsg, error.response?.data);
      throw new Error(`Custom Scraper failed: ${errMsg}`);
    }
  }
}

// Factory Pattern
export class ScraperFactory {
  static getProvider(): JobScraperProvider {
    const providerType = (process.env.SCRAPER_PROVIDER || "apify").toLowerCase();

    switch (providerType) {
      case "apify":
        return new ApifyProvider();
      case "jsearch":
        return new JSearchProvider();
      case "serpapi":
        return new SerpApiProvider();
      case "custom":
        return new CustomProvider();
      default:
        console.warn(`Unknown provider "${providerType}". Falling back to Apify.`);
        return new ApifyProvider();
    }
  }
}
