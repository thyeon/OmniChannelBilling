import { NextRequest, NextResponse } from "next/server";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { fetchReconDataForAllServices } from "@/domain/services/reconService";
import { checkDiscrepancy } from "@/domain/discrepancy";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const billingMonth = searchParams.get("billingMonth");

  if (!customerId || !billingMonth) {
    return NextResponse.json(
      { error: "customerId and billingMonth are required" },
      { status: 400 }
    );
  }

  // Fetch customer from MongoDB to get recon server configs
  const customer = await findCustomerById(customerId);
  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found" },
      { status: 404 }
    );
  }

  // Call real Recon APIs for all configured services
  const reconResults = await fetchReconDataForAllServices(customer, billingMonth);

  const usageByService = reconResults.map((result) => {
    const reconTotal = result.data?.reconTotal ?? 0;
    const reconDetails = result.data?.reconDetails ?? { sent: 0, failed: 0, withheld: 0 };

    // Provider data is still mocked for now (future: call provider APIs)
    const providerTotal = reconTotal;

    const discrepancy = checkDiscrepancy(
      reconTotal,
      providerTotal,
      customer.discrepancyThreshold
    );

    return {
      service: result.service,
      reconServerName: result.reconServerName,
      reconServerStatus: result.connectionStatus,
      recon: reconDetails,
      reconTotal,
      provider: { total: providerTotal },
      discrepancy,
      error: result.error,
    };
  });

  return NextResponse.json({
    customerId,
    billingMonth,
    services: usageByService,
  });
}
