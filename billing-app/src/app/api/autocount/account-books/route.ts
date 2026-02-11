import { NextRequest, NextResponse } from "next/server";
import {
  findAllAccountBooks,
  insertAccountBook,
} from "@/infrastructure/db/autoCountAccountBookRepository";
import { testConnection } from "@/infrastructure/external/autocountClient";

/** GET /api/autocount/account-books — Fetch all account books. */
export async function GET(): Promise<NextResponse> {
  try {
    const accountBooks = await findAllAccountBooks();
    return NextResponse.json({ accountBooks });
  } catch (error) {
    console.error("Failed to fetch account books:", error);
    return NextResponse.json(
      { error: "Failed to fetch account books" },
      { status: 500 }
    );
  }
}

/** POST /api/autocount/account-books — Create a new account book. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, accountBookId, keyId, apiKey, defaultCreditTerm, defaultSalesLocation } = body;

    // Validation
    if (!name || !accountBookId || !keyId || !apiKey || !defaultCreditTerm || !defaultSalesLocation) {
      return NextResponse.json(
        { error: "name, accountBookId, keyId, apiKey, defaultCreditTerm, and defaultSalesLocation are required" },
        { status: 400 }
      );
    }

    // Test connection before saving
    const testResult = await testConnection({ accountBookId, keyId, apiKey });
    if (!testResult.success) {
      return NextResponse.json(
        { error: `Connection test failed: ${testResult.error}` },
        { status: 400 }
      );
    }

    const accountBook = await insertAccountBook({
      name,
      accountBookId,
      keyId,
      apiKey,
      defaultCreditTerm,
      defaultSalesLocation,
    });

    return NextResponse.json({ accountBook }, { status: 201 });
  } catch (error) {
    console.error("Failed to create account book:", error);
    return NextResponse.json(
      { error: "Failed to create account book" },
      { status: 500 }
    );
  }
}
