import { generateBillableData } from "../billingService";
import * as customerRepository from "@/infrastructure/db/customerRepository";
import * as dataSourceRepository from "@/infrastructure/db/dataSourceRepository";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/infrastructure/db/customerRepository");
vi.mock("@/infrastructure/db/dataSourceRepository");

describe("billingService — INGLAB nested CUSTOM_REST_API", () => {
  const mockCustomerId = "cust-aia";
  const mockBillingMonth = "2026-03";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create one InvoiceLineItem per line_items row for INGLAB", async () => {
    const mockCustomer = {
      id: mockCustomerId,
      name: "AIA Malaysia",
      status: "ACTIVE" as const,
      rates: { SMS: 0.05, WHATSAPP: 0.05 },
      billingCycle: "MONTHLY" as const,
      discrepancyThreshold: 1.0,
    };

    const mockDataSource = {
      id: "ds_aia",
      customerId: mockCustomerId,
      type: "CUSTOM_REST_API" as const,
      serviceType: "SMS" as const,
      name: "INGLAB - AIA",
      apiEndpoint: "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB/billable",
      authType: "BEARER_TOKEN" as const,
      authCredentials: { token: "test-token" },
      sourceClientId: "CLIENT-AIA",
      nestedResponseConfig: {
        itemsPath: "items",
        lineItemsPath: "line_items",
        descriptionPath: "description",
        descriptionDetailPath: "description_detail",
        qtyPath: "qty",
        unitPricePath: "unit_price",
        servicePath: "service",
      },
      isActive: true,
    };

    vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);
    vi.spyOn(dataSourceRepository, "findActiveDataSourcesByCustomerId").mockResolvedValue([mockDataSource]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [
          {
            service: "WhatsApp Business API",
            line_items: [
              { description: "SMS", description_detail: "ECS SMS Service", qty: 100, unit_price: 0.079 },
              { description: "WhatsApp", description_detail: "ECS WhatsApp Service", qty: 50, unit_price: 0.10 },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateBillableData(mockCustomerId, mockBillingMonth);

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({
      dataSourceId: "ds_aia",
      billableCount: 100,
      unitPrice: 0.079,
      description: "SMS",
      descriptionDetail: "ECS SMS Service",
      lineItemService: "WhatsApp Business API",
    });
    expect(result.lineItems[1]).toMatchObject({
      dataSourceId: "ds_aia",
      billableCount: 50,
      unitPrice: 0.10,
      description: "WhatsApp",
      descriptionDetail: "ECS WhatsApp Service",
    });

    // Verify URL includes client_id parameter
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("client_id=CLIENT-AIA"),
      expect.any(Object)
    );
  });

  it("should use configured rate when unit_price is undefined (Gap 2)", async () => {
    const mockCustomer = {
      id: mockCustomerId,
      name: "AIA Malaysia",
      status: "ACTIVE" as const,
      rates: { SMS: 0.079 },
      billingCycle: "MONTHLY" as const,
      discrepancyThreshold: 1.0,
    };

    const mockDataSource = {
      id: "ds_aia",
      customerId: mockCustomerId,
      type: "CUSTOM_REST_API" as const,
      serviceType: "SMS" as const,
      name: "INGLAB - AIA",
      apiEndpoint: "https://example.com/billable",
      authType: "BEARER_TOKEN" as const,
      authCredentials: { token: "test-token" },
      sourceClientId: "CLIENT-AIA",
      nestedResponseConfig: {
        itemsPath: "items",
        lineItemsPath: "line_items",
        descriptionPath: "description",
        qtyPath: "qty",
        unitPricePath: "unit_price",
      },
      isActive: true,
    };

    vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);
    vi.spyOn(dataSourceRepository, "findActiveDataSourcesByCustomerId").mockResolvedValue([mockDataSource]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [{ line_items: [{ description: "SMS", qty: 100 }] }], // no unit_price
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateBillableData(mockCustomerId, mockBillingMonth);

    // When unit_price is undefined, should fall back to customer.rates.SMS = 0.079
    expect(result.lineItems[0].unitPrice).toBeUndefined();
    expect(result.lineItems[0].rate).toBe(0.079); // Gap 2: falls back to configured rate
    expect(result.lineItems[0].totalCharge).toBeCloseTo(7.90, 2); // Gap 1: qty * rate
  });
});
