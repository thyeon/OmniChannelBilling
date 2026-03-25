import { NextRequest, NextResponse } from "next/server";
import { loadCustomerConfig } from "@/domain/services/configurationService";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const customerId = request.nextUrl.searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  try {
    const config = await loadCustomerConfig(customerId);
    if (!config) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Failed to load config:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}
