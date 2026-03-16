import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/domain/services/billingExportService";

// GET /api/billing/preview - Preview export data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const client = searchParams.get("client") || "all";

    if (!period) {
      return NextResponse.json(
        { error: "period parameter is required (YYYY-MM format)" },
        { status: 400 }
      );
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: "Invalid period format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    const preview = await generatePreview(period, client);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
