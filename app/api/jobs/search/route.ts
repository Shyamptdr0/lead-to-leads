import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ScraperFactory } from "@/lib/scraper";
import { prisma } from "@/lib/prisma";

// Zod schemas for validation
const JobSearchFiltersSchema = z.object({
  experience: z.enum(["Entry Level", "Mid Level", "Senior"]).optional(),
  employmentType: z.enum(["Full Time", "Part Time", "Internship", "Contract"]).optional(),
  remote: z.boolean().optional(),
  posted: z.enum(["Today", "Last 3 Days", "Last Week", "Last Month"]).optional(),
  salary: z.string().optional(),
  company: z.string().optional(),
});

const JobSearchParamsSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  location: z.string().min(1, "Location is required"),
  filters: JobSearchFiltersSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate inputs
    const result = JobSearchParamsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: result.error.format() },
        { status: 400 }
      );
    }

    const { title, location, filters } = result.data;

    // Get the scraper provider configured in .env
    const provider = ScraperFactory.getProvider();
    
    // Fetch live jobs
    let jobs = await provider.searchJobs({ title, location, filters });

    // Client-side filtering logic to guarantee accuracy
    if (filters) {
      jobs = jobs.filter((job) => {
        // 1. Experience level
        if (filters.experience && job.experience && job.experience !== filters.experience) {
          return false;
        }
        // 2. Employment type
        if (
          filters.employmentType &&
          job.employmentType &&
          job.employmentType !== filters.employmentType
        ) {
          return false;
        }
        // 3. Remote
        if (filters.remote !== undefined) {
          if (filters.remote && !job.remote) return false;
          if (!filters.remote && job.remote) return false;
        }
        // 4. Company matching
        if (
          filters.company &&
          !job.company.toLowerCase().includes(filters.company.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
    }

    // Save search history if database is available
    try {
      const session = await getServerSession(authOptions);
      if (process.env.DATABASE_URL) {
        // If logged in, associate search with user. Otherwise, write it if we want anonymous search logs or skip.
        // We will log searches for both registered & demo users.
        const userId = session?.user?.id || "anonymous-search";
        
        // Ensure user exists if logging search
        if (session?.user?.id) {
          await prisma.searchHistory.create({
            data: {
              userId: session.user.id,
              title,
              location,
              filters: filters ? JSON.stringify(filters) : undefined,
            },
          });
        }
      }
    } catch (dbError) {
      console.warn("Could not save search history to database:", dbError);
    }

    return NextResponse.json({
      success: true,
      provider: process.env.SCRAPER_PROVIDER || "apify",
      count: jobs.length,
      jobs,
    });
  } catch (error: any) {
    console.error("Search API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred while searching jobs." },
      { status: 500 }
    );
  }
}
