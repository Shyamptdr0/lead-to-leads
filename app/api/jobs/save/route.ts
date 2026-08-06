import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        jobs: [],
        dbConnected: false,
        message: "Database not connected. Using local mock storage on client.",
      });
    }

    const savedJobs = await prisma.savedJob.findMany({
      where: { userId: session.user.id },
      orderBy: { savedAt: "desc" },
    });

    // Transform fields if necessary
    return NextResponse.json({
      success: true,
      jobs: savedJobs,
      dbConnected: true,
    });
  } catch (error: any) {
    console.error("GET saved jobs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch saved jobs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await req.json();
    if (!job.id || !job.title || !job.company) {
      return NextResponse.json({ error: "Invalid job payload" }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        dbConnected: false,
        message: "Bookmark simulated. Database not connected.",
      });
    }

    // Upsert or create bookmark
    const savedJob = await prisma.savedJob.upsert({
      where: {
        userId_jobId: {
          userId: session.user.id,
          jobId: job.id,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        jobId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary || null,
        experience: job.experience || null,
        employmentType: job.employmentType || null,
        remote: job.remote || false,
        postedAt: job.postedAt || null,
        description: job.description || null,
        skills: job.skills || [],
        jobUrl: job.jobUrl,
        companyLogo: job.companyLogo || null,
        source: job.source,
      },
    });

    return NextResponse.json({
      success: true,
      job: savedJob,
      dbConnected: true,
    });
  } catch (error: any) {
    console.error("POST save job error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save job" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        dbConnected: false,
        message: "Unbookmark simulated. Database not connected.",
      });
    }

    await prisma.savedJob.delete({
      where: {
        userId_jobId: {
          userId: session.user.id,
          jobId: jobId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Job bookmark removed",
      dbConnected: true,
    });
  } catch (error: any) {
    console.error("DELETE saved job error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove job bookmark" },
      { status: 500 }
    );
  }
}
