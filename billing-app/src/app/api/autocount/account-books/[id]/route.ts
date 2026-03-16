import { NextRequest, NextResponse } from "next/server";
import {
  findAccountBookById,
  updateAccountBook,
  deleteAccountBook,
  countCustomersByAccountBook,
} from "@/infrastructure/db/autoCountAccountBookRepository";
import { testConnection } from "@/infrastructure/external/autocountClient";

interface RouteParams {
  params: { id: string };
}

/** GET /api/autocount/account-books/[id] — Fetch a single account book. */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const accountBook = await findAccountBookById(params.id);
    if (!accountBook) {
      return NextResponse.json({ error: "Account book not found" }, { status: 404 });
    }
    return NextResponse.json({ accountBook });
  } catch (error) {
    console.error("Failed to fetch account book:", error);
    return NextResponse.json(
      { error: "Failed to fetch account book" },
      { status: 500 }
    );
  }
}

/** PUT /api/autocount/account-books/[id] — Update an account book. */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, accountBookId, keyId, apiKey, defaultCreditTerm, defaultSalesLocation, defaultTaxCode, taxEntity } = body;

    // If credentials changed, test connection before updating
    if (accountBookId || keyId || apiKey) {
      const existing = await findAccountBookById(params.id);
      if (!existing) {
        return NextResponse.json({ error: "Account book not found" }, { status: 404 });
      }

      const testResult = await testConnection({
        accountBookId: accountBookId ?? existing.accountBookId,
        keyId: keyId ?? existing.keyId,
        apiKey: apiKey ?? existing.apiKey,
      });

      if (!testResult.success) {
        return NextResponse.json(
          { error: `Connection test failed: ${testResult.error}` },
          { status: 400 }
        );
      }
    }

    const accountBook = await updateAccountBook(params.id, {
      name,
      accountBookId,
      keyId,
      apiKey,
      defaultCreditTerm,
      defaultSalesLocation,
      defaultTaxCode,
      taxEntity,
    });

    if (!accountBook) {
      return NextResponse.json({ error: "Account book not found" }, { status: 404 });
    }

    return NextResponse.json({ accountBook });
  } catch (error) {
    console.error("Failed to update account book:", error);
    return NextResponse.json(
      { error: "Failed to update account book" },
      { status: 500 }
    );
  }
}

/** DELETE /api/autocount/account-books/[id] — Delete an account book. */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Check if any customers are linked
    const customerCount = await countCustomersByAccountBook(params.id);
    if (customerCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete account book: ${customerCount} customer(s) are linked to it`,
        },
        { status: 400 }
      );
    }

    const deleted = await deleteAccountBook(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Account book not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete account book:", error);
    return NextResponse.json(
      { error: "Failed to delete account book" },
      { status: 500 }
    );
  }
}
