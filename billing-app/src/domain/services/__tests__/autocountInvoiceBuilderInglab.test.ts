import { buildAutoCountInvoice } from "../autocountInvoiceBuilder";
import * as autoCountAccountBookRepository from "@/infrastructure/db/autoCountAccountBookRepository";
import * as serviceProductMappingRepository from "@/infrastructure/db/serviceProductMappingRepository";
import * as customerProductMappingRepository from "@/infrastructure/db/customerProductMappingRepository";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/infrastructure/db/autoCountAccountBookRepository");
vi.mock("@/infrastructure/db/serviceProductMappingRepository");
vi.mock("@/infrastructure/db/customerProductMappingRepository");

describe("autocountInvoiceBuilder — uses actual INGLAB line item values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use lineItem.unitPrice and lineItem.description when present (ITEMIZED)", async () => {
    const customer = {
      id: "cust_aia",
      name: "AIA Malaysia",
      autocountAccountBookId: "ab_001",
      autocountDebtorCode: "AIA-001",
      defaultFields: {},
    };
    const billingMonth = "2026-03";
    const lineItems = [
      {
        dataSourceId: "ds_aia",
        lineIdentifier: "SMS",
        service: "SMS" as const,
        hasProvider: true,
        reconServerStatus: "SUCCESS" as const,
        providerStatus: "SUCCESS" as const,
        reconServerName: "INGLAB",
        providerName: "GTS",
        reconTotal: 100,
        reconDetails: { sent: 100, failed: 0, withheld: 0 },
        providerTotal: 100,
        discrepancyPercentage: 0,
        isMismatch: false,
        thresholdUsed: 0,
        billableCount: 100,
        wasOverridden: false,
        rate: 0.079,
        totalCharge: 7.90,
        // INGLAB fields:
        unitPrice: 0.079,
        description: "SMS",
        descriptionDetail: "ECS SMS Service",
        lineItemService: "WhatsApp Business API",
      },
    ];

    vi.spyOn(autoCountAccountBookRepository, "findAccountBookById").mockResolvedValue({
      id: "ab_001",
      accountBookId: "AB001",
      name: "AutoCount Book",
      defaultCreditTerm: "30",
      defaultSalesLocation: "HQ",
      defaultSalesAgent: "Olivia Yap",
      defaultAccNo: "500-0000",
      defaultTaxCode: "SR",
      inclusiveTax: false,
    });
    vi.spyOn(serviceProductMappingRepository, "findMappingByAccountBookAndService").mockResolvedValue({
      id: "mapping_inglab",
      accountBookId: "ab_001",
      serviceType: "SMS",
      productCode: "SMS-INGLAB",
      accNo: "500-100",
      description: "INGLAB SMS Service",
      defaultUnitPrice: 0.05,
      defaultBillingMode: "ITEMIZED",
    });
    vi.spyOn(customerProductMappingRepository, "findCustomerProductMappingByKey").mockResolvedValue(null);

    const result = await buildAutoCountInvoice({ customer, billingMonth, lineItems });

    expect(result.success).toBe(true);
    const detail = result.payload!.details[0];
    expect(detail.unitPrice).toBe(0.079);       // From lineItem.unitPrice, not product mapping default 0.05
    expect(detail.description).toContain("SMS"); // Uses lineItem.description when present
    expect(detail.qty).toBe(100);               // ITEMIZED mode uses billableCount
  });

  it("should fall back to product mapping when lineItem.unitPrice is undefined", async () => {
    const customer = {
      id: "cust_coway",
      name: "Coway",
      autocountAccountBookId: "ab_001",
      autocountDebtorCode: "COWAY-001",
      defaultFields: {},
    };
    const billingMonth = "2026-03";
    const lineItems = [
      {
        dataSourceId: "ds_coway",
        lineIdentifier: "SMS",
        service: "SMS" as const,
        hasProvider: true,
        reconServerStatus: "SUCCESS" as const,
        providerStatus: "SUCCESS" as const,
        reconServerName: "Recon",
        providerName: "GTS",
        reconTotal: 50,
        reconDetails: { sent: 50, failed: 0, withheld: 0 },
        providerTotal: 50,
        discrepancyPercentage: 0,
        isMismatch: false,
        thresholdUsed: 0,
        billableCount: 50,
        wasOverridden: false,
        rate: 0.05,
        totalCharge: 2.50,
        // No INGLAB fields — uses product mapping
      },
    ];

    vi.spyOn(autoCountAccountBookRepository, "findAccountBookById").mockResolvedValue({
      id: "ab_001",
      accountBookId: "AB001",
      name: "AutoCount Book",
      defaultCreditTerm: "30",
      defaultSalesLocation: "HQ",
      defaultSalesAgent: "Olivia Yap",
      defaultAccNo: "500-0000",
      defaultTaxCode: "SR",
      inclusiveTax: false,
    });
    vi.spyOn(serviceProductMappingRepository, "findMappingByAccountBookAndService").mockResolvedValue({
      id: "mapping_1",
      accountBookId: "ab_001",
      serviceType: "SMS",
      productCode: "SMS-001",
      accNo: "500-100",
      description: "SMS Service",
      defaultUnitPrice: 0.06,
      defaultBillingMode: "ITEMIZED",
    });
    vi.spyOn(customerProductMappingRepository, "findCustomerProductMappingByKey").mockResolvedValue(null);

    const result = await buildAutoCountInvoice({ customer, billingMonth, lineItems });

    expect(result.success).toBe(true);
    // Should use product mapping unitPrice (0.06), not lineItem.rate (0.05)
    const detail = result.payload!.details[0];
    expect(detail.unitPrice).toBe(0.06);
  });
});
