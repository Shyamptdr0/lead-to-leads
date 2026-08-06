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
        history: [],
        dbConnected: false,
        message: "Database not connected. No history stored.",
      });
    }

    const history = await prisma.searchHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20, // Limit to recent 20
    });

    // Parse filters back if they were stored as stringified JSON or Json objects
    const parsedHistory = history.map((item) => {
      let parsedFilters = {};
      if (item.filters) {
        try {
          parsedFilters = typeof item.filters === "string" 
            ? JSON.parse(item.filters) 
            : item.filters;
        } catch (e) {
          console.error("Failed to parse filters for history item", item.id);
        }
      }
      return {
        id: item.id,
        title: item.title,
        location: item.location,
        filters: parsedFilters,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      history: parsedHistory,
      dbConnected: true,
    });
  } catch (error: any) {
    console.error("GET search history error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch search history" },
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

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        dbConnected: false,
        message: "History clear simulated. Database not connected.",
      });
    }

    await prisma.searchHistory.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: "Search history cleared",
      dbConnected: true,
    });
  } catch (error: any) {
    console.error("DELETE search history error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear search history" },
      { status: 500 }
    );
  }
}
