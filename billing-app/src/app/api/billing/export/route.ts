import { NextRequest, NextResponse } from "next/server";
import { generatePreview, generateCSV } from "@/domain/services/billingExportService";
import fs from "fs";
import path from "path";

const EXPORTS_DIR = path.join(process.cwd(), "public", "exports");

// Ensure exports directory exists
function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

// GET /api/billing/export - Download CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const client = searchParams.get("client") || "all";

    if (!period) {
      return NextResponse.json(
        { error: "period parameter is required" },
        { status: 400 }
      );
    }

    const preview = await generatePreview(period, client);

    if (preview.total_rows === 0) {
      return NextResponse.json(
        { error: "No data found for the selected period and client" },
        { status: 404 }
      );
    }

    const csv = generateCSV(preview.data);

    // Generate filename
    const clientPart = client === "all" ? "AllClients" : client.replace(/\s+/g, "");
    const filename = `INGLAB_Billing_${period}_${clientPart}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting billing:", error);
    return NextResponse.json(
      { error: "Failed to export billing data" },
      { status: 500 }
    );
  }
}

// POST /api/billing/export - Save CSV to server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, client } = body;

    if (!period) {
      return NextResponse.json(
        { error: "period is required" },
        { status: 400 }
      );
    }

    const clientName = client || "all";
    const preview = await generatePreview(period, clientName);

    if (preview.total_rows === 0) {
      return NextResponse.json(
        { error: "No data found for the selected period and client" },
        { status: 404 }
      );
    }

    const csv = generateCSV(preview.data);

    // Save to server
    ensureExportsDir();
    const clientPart = clientName === "all" ? "AllClients" : clientName.replace(/\s+/g, "");
    const filename = `INGLAB_Billing_${period}_${clientPart}.csv`;
    const filePath = path.join(EXPORTS_DIR, filename);

    fs.writeFileSync(filePath, csv);

    // Return the download URL
    const downloadUrl = `/exports/${filename}`;

    return NextResponse.json({
      success: true,
      filename,
      download_url: downloadUrl,
      row_count: preview.total_rows,
      period,
      client: clientName,
    });
  } catch (error) {
    console.error("Error saving billing export:", error);
    return NextResponse.json(
      { error: "Failed to save billing export" },
      { status: 500 }
    );
  }
}
