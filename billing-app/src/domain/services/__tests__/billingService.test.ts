/**
 * Tests for BillingService - Customer Status Check
 */

import { generateBillableData } from "../billingService";
import * as customerRepository from "@/infrastructure/db/customerRepository";
import * as dataSourceRepository from "@/infrastructure/db/dataSourceRepository";
import { describe, it, expect, beforeEach, vi, spyOn } from "vitest";

vi.mock("@/infrastructure/db/customerRepository");
vi.mock("@/infrastructure/db/dataSourceRepository");

describe("billingService - customer status check", () => {
  const mockCustomerId = "cust-123";
  const mockBillingMonth = "2026-03";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBillableData", () => {
    it("should process ACTIVE customers normally", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        name: "Test Customer",
        status: "ACTIVE" as const,
        rates: { SMS: 0.05 },
        dataSources: [],
        billingCycle: "MONTHLY" as const,
      };

      // Empty data sources triggers early return with empty lineItems
      vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);
      vi.spyOn(dataSourceRepository, "findActiveDataSourcesByCustomerId").mockResolvedValue([]);

      const result = await generateBillableData(mockCustomerId, mockBillingMonth);

      expect(result.customer).toEqual(mockCustomer);
      expect(result.lineItems).toEqual([]);
      expect(result.reason).toBeUndefined();
    }, 10000);

    it("should skip SUSPENDED customers and return reason 'skipped'", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        name: "Suspended Customer",
        status: "SUSPENDED" as const,
        rates: { SMS: 0.05 },
        dataSources: [],
        billingCycle: "MONTHLY" as const,
      };

      vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);

      const result = await generateBillableData(mockCustomerId, mockBillingMonth);

      expect(result.customer).toEqual(mockCustomer);
      expect(result.lineItems).toEqual([]);
      expect(result.reason).toBe("skipped");
    });

    it("should skip MAINTENANCE customers and return reason 'skipped'", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        name: "Maintenance Customer",
        status: "MAINTENANCE" as const,
        rates: { SMS: 0.05 },
        dataSources: [],
        billingCycle: "MONTHLY" as const,
      };

      vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);

      const result = await generateBillableData(mockCustomerId, mockBillingMonth);

      expect(result.customer).toEqual(mockCustomer);
      expect(result.lineItems).toEqual([]);
      expect(result.reason).toBe("skipped");
    });

    it("should return null customer when customer not found", async () => {
      vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(null);

      const result = await generateBillableData(mockCustomerId, mockBillingMonth);

      expect(result.customer).toBeNull();
      expect(result.lineItems).toEqual([]);
      expect(result.reason).toBeUndefined();
    });
  });
});
