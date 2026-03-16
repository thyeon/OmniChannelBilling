import { NextRequest, NextResponse } from "next/server";
import { findAllExportHistory, findExportHistoryByPeriod, findExportHistoryByClient } from "@/infrastructure/db/billingExportHistoryRepository";

// GET /api/billing/history - Get export history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const client = searchParams.get("client");

    let history;

    if (period) {
      history = await findExportHistoryByPeriod(period);
    } else if (client) {
      history = await findExportHistoryByClient(client);
    } else {
      history = await findAllExportHistory();
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching export history:", error);
    return NextResponse.json(
      { error: "Failed to fetch export history" },
      { status: 500 }
    );
  }
}
