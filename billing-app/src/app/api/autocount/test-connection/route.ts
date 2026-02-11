import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/infrastructure/external/autocountClient";

/** POST /api/autocount/test-connection — Test AutoCount credentials. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { accountBookId, keyId, apiKey } = body;

    if (!accountBookId || !keyId || !apiKey) {
      return NextResponse.json(
        { error: "accountBookId, keyId, and apiKey are required" },
        { status: 400 }
      );
    }

    const result = await testConnection({ accountBookId, keyId, apiKey });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test connection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
