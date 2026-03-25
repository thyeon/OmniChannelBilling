import { NextRequest, NextResponse } from "next/server";
import { invalidateCustomerCache } from "@/domain/services/configurationService";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    await invalidateCustomerCache(customerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
  }
}
