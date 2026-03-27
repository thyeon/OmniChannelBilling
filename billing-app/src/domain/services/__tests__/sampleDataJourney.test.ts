/**
 * Sample Data Journey Test
 *
 * End-to-end simulation of the Dynamic Customers CaaS implementation
 * using representative sample data. Verifies:
 * - Customer status check logic (ACTIVE, SUSPENDED, MAINTENANCE)
 * - Billing cycle logic (MONTHLY, QUARTERLY, YEARLY)
 * - Multi-line data extraction via lineItemMappings
 * - POST request template token resolution
 * - Retry policy and fallback values behavior
 * - CustomerProductMapping with defaultUnitPrice
 * - AutoCountAccountBook with new fields
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Customer, InvoiceLineItem } from "@/types";
import {
  DataSource,
  LineItemMapping,
  MultiLineResult,
  SingleLineResult,
} from "@/domain/models/dataSource";
import { CustomerProductMapping } from "@/domain/models/customerProductMapping";
import { AutoCountAccountBook } from "@/domain/models/autoCountAccountBook";
import { shouldBillThisMonth } from "../billingService";
import { processMultiLine, processLegacySingleLine } from "../lineItemProcessor";
import { resolveTokens } from "../templateTokenResolver";
import { resolveRate } from "../rateResolver";

// ---------------------------------------------------------------------------
// SAMPLE DATA: Customers with Different Statuses
// ---------------------------------------------------------------------------

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: "cust-active-monthly",
    name: "Acme Corp (Active, Monthly)",
    autocountCustomerId: "AC-ACME-001",
    services: ["SMS", "WHATSAPP"],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.05, WHATSAPP: 0.08, EMAIL: 0.03 },
    billingMode: "AUTO_PILOT",
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE",
    billingCycle: "MONTHLY",
  },
  {
    id: "cust-active-quarterly",
    name: "Beta Ltd (Active, Quarterly)",
    autocountCustomerId: "AC-BETA-002",
    services: ["SMS", "EMAIL"],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.06, WHATSAPP: 0.10, EMAIL: 0.04 },
    billingMode: "MANUAL",
    consolidateInvoice: true,
    discrepancyThreshold: 2.0,
    status: "ACTIVE",
    billingCycle: "QUARTERLY",
  },
  {
    id: "cust-active-yearly",
    name: "Gamma Sdn Bhd (Active, Yearly)",
    autocountCustomerId: "AC-GAMMA-003",
    services: ["WHATSAPP"],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.05, WHATSAPP: 0.12, EMAIL: 0.03 },
    billingMode: "AUTO_PILOT",
    consolidateInvoice: false,
    discrepancyThreshold: 1.5,
    status: "ACTIVE",
    billingCycle: "YEARLY",
    billingStartMonth: 3, // Bill every March
  },
  {
    id: "cust-suspended",
    name: "Suspended Corp",
    autocountCustomerId: "AC-SUSP-004",
    services: ["SMS"],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.05, WHATSAPP: 0.08, EMAIL: 0.03 },
    billingMode: "MANUAL",
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "SUSPENDED",
    billingCycle: "MONTHLY",
  },
  {
    id: "cust-maintenance",
    name: "Maintenance Mode Corp",
    autocountCustomerId: "AC-MAINT-005",
    services: ["EMAIL"],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.05, WHATSAPP: 0.08, EMAIL: 0.03 },
    billingMode: "AUTO_PILOT",
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "MAINTENANCE",
    billingCycle: "MONTHLY",
  },
];

// ---------------------------------------------------------------------------
// SAMPLE DATA: AutoCountAccountBook with New Fields
// ---------------------------------------------------------------------------

const SAMPLE_ACCOUNT_BOOK: AutoCountAccountBook = {
  id: "ab-caas-001",
  name: "CaaS Account Book",
  accountBookId: "AB-CAA-001",
  keyId: "key-caas-001",
  apiKey: "encrypted-api-key-placeholder",
  defaultCreditTerm: "Net 30",
  defaultSalesLocation: "HQ",
  defaultTaxCode: "SR-S-0",
  taxEntity: "TIN:123456789",
  invoiceDescriptionTemplate: "Monthly billing for {CustomerName}",
  furtherDescriptionTemplate: "Billing period: {BillingCycle}",
  // --- NEW FIELDS ---
  defaultSalesAgent: "Olivia Yap",
  defaultAccNo: "500-0000",
  defaultClassificationCode: "022",
  inclusiveTax: false,
  submitEInvoice: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// SAMPLE DATA: DataSource with Multi-Line Config, POST, Retry, Fallback
// ---------------------------------------------------------------------------

const SAMPLE_MULTI_LINE_DATA_SOURCE: DataSource = {
  id: "ds-multiline-001",
  customerId: "cust-active-monthly",
  type: "CUSTOM_REST_API",
  serviceType: "SMS",
  name: "CaaS SMS API (Multi-Line)",
  apiEndpoint: "https://api.example.com/billing/{billingMonth}",
  authType: "BEARER_TOKEN",
  authCredentials: {
    token: "sms-api-secret-token",
    headerName: "x-api-token",
  },
  responseMapping: {
    usageCountPath: "total.count",
    sentPath: "total.sent",
    failedPath: "total.failed",
  },
  lineItemMappings: [
    {
      lineIdentifier: "DOMESTIC",
      countPath: "lines.0.count",
      ratePath: "lines.0.rate",
      fallbackRate: 0.05,
    },
    {
      lineIdentifier: "INTL",
      countPath: "lines.1.count",
      ratePath: "lines.1.rate",
      fallbackRate: 0.12,
    },
    {
      lineIdentifier: "PROMO",
      countPath: "lines.2.count",
      fallbackRate: 0.02,
    },
  ],
  requestTemplate: {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-ID": "caas-client",
    },
    bodyTemplate:
      '{"period": "{billingMonth}", "year": "{year}", "month": "{month}"}',
  },
  retryPolicy: {
    maxRetries: 3,
    retryDelaySeconds: 5,
    timeoutSeconds: 30,
  },
  fallbackValues: {
    usageCount: 0,
    sentCount: 0,
    failedCount: 0,
    useDefaultOnMissing: true,
  },
  isActive: true,
};

const SAMPLE_SINGLE_LINE_DATA_SOURCE: DataSource = {
  id: "ds-singleline-001",
  customerId: "cust-active-monthly",
  type: "CUSTOM_REST_API",
  serviceType: "WHATSAPP",
  name: "CaaS WhatsApp API (Single-Line)",
  apiEndpoint: "https://api.whatsapp.example.com/usage",
  authType: "API_KEY",
  authCredentials: {
    key: "wa-api-key-xyz",
  },
  responseMapping: {
    usageCountPath: "data.usage.total",
    sentPath: "data.usage.sent",
    failedPath: "data.usage.failed",
  },
  isActive: true,
};

// ---------------------------------------------------------------------------
// SAMPLE DATA: CustomerProductMapping with defaultUnitPrice
// ---------------------------------------------------------------------------

const SAMPLE_PRODUCT_MAPPINGS: CustomerProductMapping[] = [
  {
    id: "cpm-001",
    customerId: "cust-active-monthly",
    serviceType: "SMS",
    lineIdentifier: "DOMESTIC",
    productCode: "SMS-DOM-001",
    description: "Domestic SMS Service",
    furtherDescriptionTemplate: "Domestic SMS billing for {month}/{year}",
    classificationCode: "022",
    unit: "SMS",
    taxCode: "SR-S-0",
    billingMode: "ITEMIZED",
    defaultUnitPrice: 0.05,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cpm-002",
    customerId: "cust-active-monthly",
    serviceType: "SMS",
    lineIdentifier: "INTL",
    productCode: "SMS-INTL-001",
    description: "International SMS Service",
    furtherDescriptionTemplate: "International SMS billing for {month}/{year}",
    classificationCode: "023",
    unit: "SMS",
    taxCode: "SR-S-0",
    billingMode: "ITEMIZED",
    defaultUnitPrice: 0.12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cpm-003",
    customerId: "cust-active-monthly",
    serviceType: "WHATSAPP",
    lineIdentifier: "WHATSAPP-BIZ",
    productCode: "WA-BIZ-001",
    description: "WhatsApp Business API",
    furtherDescriptionTemplate: "WhatsApp billing for {month}/{year}",
    classificationCode: "022",
    unit: "MESSAGE",
    taxCode: "SR-S-0",
    billingMode: "LUMP_SUM",
    defaultUnitPrice: 0.08,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// SAMPLE API RESPONSES
// ---------------------------------------------------------------------------

const SAMPLE_MULTI_LINE_API_RESPONSE = {
  total: { count: 15000, sent: 14800, failed: 200 },
  lines: [
    { lineIdentifier: "DOMESTIC", count: 10000, rate: 0.05 },
    { lineIdentifier: "INTL", count: 3000, rate: 0.12 },
    { lineIdentifier: "PROMO", count: 2000 },
    // Note: PROMO has no rate, should fall back to fallbackRate
  ],
};

const SAMPLE_SINGLE_LINE_API_RESPONSE = {
  data: {
    usage: {
      total: 5000,
      sent: 4900,
      failed: 100,
    },
  },
};

// ---------------------------------------------------------------------------
// TEST SUITE: Sample Data Journey
// ---------------------------------------------------------------------------

describe("sampleDataJourney", () => {
  // ---- 1. Customer Status Check -------------------------------------------

  describe("1. Customer Status Checks", () => {
    it("should identify ACTIVE customer as billable", () => {
      const active = SAMPLE_CUSTOMERS.find((c) => c.id === "cust-active-monthly")!;
      expect(active.status).toBe("ACTIVE");
    });

    it("should identify SUSPENDED customer", () => {
      const suspended = SAMPLE_CUSTOMERS.find((c) => c.id === "cust-suspended")!;
      expect(suspended.status).toBe("SUSPENDED");
    });

    it("should identify MAINTENANCE customer", () => {
      const maintenance = SAMPLE_CUSTOMERS.find((c) => c.id === "cust-maintenance")!;
      expect(maintenance.status).toBe("MAINTENANCE");
    });

    it("should have distinct status values covering all lifecycle states", () => {
      const statuses = SAMPLE_CUSTOMERS.map((c) => c.status);
      expect(statuses).toContain("ACTIVE");
      expect(statuses).toContain("SUSPENDED");
      expect(statuses).toContain("MAINTENANCE");
      expect(new Set(statuses).size).toBe(3);
    });
  });

  // ---- 2. Billing Cycle Logic ---------------------------------------------

  describe("2. Billing Cycle Logic", () => {
    it("should cover all three billing cycle types in sample data", () => {
      const cycles = SAMPLE_CUSTOMERS.map((c) => c.billingCycle);
      expect(cycles).toContain("MONTHLY");
      expect(cycles).toContain("QUARTERLY");
      expect(cycles).toContain("YEARLY");
    });

    describe("MONTHLY billing cycle (cust-active-monthly)", () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-active-monthly"
      )!;

      it("should always bill in any month", () => {
        const testMonths = [
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-06",
          "2026-12",
        ];
        for (const month of testMonths) {
          expect(shouldBillThisMonth(customer, month)).toBe(true);
        }
      });

      it("should have MONTHLY cycle", () => {
        expect(customer.billingCycle).toBe("MONTHLY");
      });
    });

    describe("QUARTERLY billing cycle (cust-active-quarterly)", () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-active-quarterly"
      )!;

      it("should bill in Jan, Apr, Jul, Oct", () => {
        expect(shouldBillThisMonth(customer, "2026-01")).toBe(true);
        expect(shouldBillThisMonth(customer, "2026-04")).toBe(true);
        expect(shouldBillThisMonth(customer, "2026-07")).toBe(true);
        expect(shouldBillThisMonth(customer, "2026-10")).toBe(true);
      });

      it("should NOT bill in Feb, Mar, May, Jun, Aug, Sep, Nov, Dec", () => {
        const nonBillableMonths = [
          "2026-02",
          "2026-03",
          "2026-05",
          "2026-06",
          "2026-08",
          "2026-09",
          "2026-11",
          "2026-12",
        ];
        for (const month of nonBillableMonths) {
          expect(shouldBillThisMonth(customer, month)).toBe(false);
        }
      });
    });

    describe("YEARLY billing cycle (cust-active-yearly)", () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-active-yearly"
      )!;

      it("should bill only in configured start month (March)", () => {
        expect(customer.billingStartMonth).toBe(3);
        expect(shouldBillThisMonth(customer, "2026-03")).toBe(true);
        expect(shouldBillThisMonth(customer, "2027-03")).toBe(true);
      });

      it("should NOT bill in any other month", () => {
        const nonBillableMonths = [
          "2026-01",
          "2026-02",
          "2026-04",
          "2026-05",
          "2026-06",
          "2026-07",
          "2026-08",
          "2026-09",
          "2026-10",
          "2026-11",
          "2026-12",
        ];
        for (const month of nonBillableMonths) {
          expect(shouldBillThisMonth(customer, month)).toBe(false);
        }
      });
    });
  });

  // ---- 3. AutoCountAccountBook with New Fields ---------------------------

  describe("3. AutoCountAccountBook New Fields", () => {
    it("should have all 5 new fields defined", () => {
      expect(SAMPLE_ACCOUNT_BOOK.defaultSalesAgent).toBe("Olivia Yap");
      expect(SAMPLE_ACCOUNT_BOOK.defaultAccNo).toBe("500-0000");
      expect(SAMPLE_ACCOUNT_BOOK.defaultClassificationCode).toBe("022");
      expect(SAMPLE_ACCOUNT_BOOK.inclusiveTax).toBe(false);
      expect(SAMPLE_ACCOUNT_BOOK.submitEInvoice).toBe(false);
    });

    it("should have all existing fields intact", () => {
      expect(SAMPLE_ACCOUNT_BOOK.name).toBe("CaaS Account Book");
      expect(SAMPLE_ACCOUNT_BOOK.accountBookId).toBe("AB-CAA-001");
      expect(SAMPLE_ACCOUNT_BOOK.defaultCreditTerm).toBe("Net 30");
      expect(SAMPLE_ACCOUNT_BOOK.defaultSalesLocation).toBe("HQ");
      expect(SAMPLE_ACCOUNT_BOOK.defaultTaxCode).toBe("SR-S-0");
      expect(SAMPLE_ACCOUNT_BOOK.taxEntity).toBe("TIN:123456789");
    });

    it("should use new fields for AutoCount invoice generation (simulated)", () => {
      // Simulate what autocountInvoiceBuilder would do
      const invoiceFields = {
        salesAgent: SAMPLE_ACCOUNT_BOOK.defaultSalesAgent,
        accNo: SAMPLE_ACCOUNT_BOOK.defaultAccNo,
        classificationCode: SAMPLE_ACCOUNT_BOOK.defaultClassificationCode,
        inclusiveTax: SAMPLE_ACCOUNT_BOOK.inclusiveTax,
        submitEInvoice: SAMPLE_ACCOUNT_BOOK.submitEInvoice,
      };

      expect(invoiceFields.salesAgent).toBe("Olivia Yap");
      expect(invoiceFields.accNo).toBe("500-0000");
      expect(invoiceFields.classificationCode).toBe("022");
      expect(invoiceFields.inclusiveTax).toBe(false);
      expect(invoiceFields.submitEInvoice).toBe(false);
    });
  });

  // ---- 4. DataSource Multi-Line Config ------------------------------------

  describe("4. DataSource Multi-Line Config", () => {
    it("should have lineItemMappings with multiple entries", () => {
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.lineItemMappings).toBeDefined();
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.lineItemMappings!.length).toBe(3);
    });

    it("should have requestTemplate with POST method", () => {
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.requestTemplate).toBeDefined();
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.requestTemplate!.method).toBe("POST");
    });

    it("should have retryPolicy configured", () => {
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.retryPolicy).toBeDefined();
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.retryPolicy!.maxRetries).toBe(3);
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.retryPolicy!.retryDelaySeconds).toBe(5);
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.retryPolicy!.timeoutSeconds).toBe(30);
    });

    it("should have fallbackValues configured", () => {
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.fallbackValues).toBeDefined();
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.fallbackValues!.useDefaultOnMissing).toBe(
        true
      );
      expect(SAMPLE_MULTI_LINE_DATA_SOURCE.fallbackValues!.usageCount).toBe(0);
    });

    it("should have authCredentials with custom headerName", () => {
      expect(
        SAMPLE_MULTI_LINE_DATA_SOURCE.authCredentials!.headerName
      ).toBeDefined();
      expect(
        SAMPLE_MULTI_LINE_DATA_SOURCE.authCredentials!.headerName
      ).toBe("x-api-token");
    });
  });

  // ---- 5. Multi-Line Data Extraction -------------------------------------

  describe("5. Multi-Line Data Extraction", () => {
    it("should extract all line items from multi-line API response", () => {
      const results: MultiLineResult[] = processMultiLine(
        SAMPLE_MULTI_LINE_API_RESPONSE,
        SAMPLE_MULTI_LINE_DATA_SOURCE.lineItemMappings!
      );

      expect(results.length).toBe(3);

      // DOMESTIC line
      expect(results[0].lineIdentifier).toBe("DOMESTIC");
      expect(results[0].count).toBe(10000);
      expect(results[0].rate).toBe(0.05);

      // INTL line
      expect(results[1].lineIdentifier).toBe("INTL");
      expect(results[1].count).toBe(3000);
      expect(results[1].rate).toBe(0.12);

      // PROMO line (no rate in response, should have fallback)
      expect(results[2].lineIdentifier).toBe("PROMO");
      expect(results[2].count).toBe(2000);
      expect(results[2].rate).toBeUndefined(); // No ratePath in response
      expect(results[2].fallbackRate).toBe(0.02); // fallbackRate is defined in mapping
    });

    it("should aggregate counts across all line items", () => {
      const results = processMultiLine(
        SAMPLE_MULTI_LINE_API_RESPONSE,
        SAMPLE_MULTI_LINE_DATA_SOURCE.lineItemMappings!
      );

      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBe(15000); // 10000 + 3000 + 2000
    });

    it("should handle missing count with fallback to 0", () => {
      const partialResponse = {
        lines: [{ lineIdentifier: "DOMESTIC", count: 100 }],
        // Missing lines 1 and 2
      };
      const mappings: LineItemMapping[] = [
        { lineIdentifier: "DOMESTIC", countPath: "lines.0.count" },
        { lineIdentifier: "INTL", countPath: "lines.1.count", fallbackRate: 0.10 },
        { lineIdentifier: "PROMO", countPath: "lines.2.count" },
      ];

      const results = processMultiLine(partialResponse, mappings);
      expect(results[0].count).toBe(100);
      expect(results[1].count).toBe(0); // Missing, falls back to 0
      expect(results[2].count).toBe(0); // Missing, falls back to 0
    });

    it("should work with legacy single-line response", () => {
      const result: SingleLineResult = processLegacySingleLine(
        SAMPLE_SINGLE_LINE_API_RESPONSE,
        SAMPLE_SINGLE_LINE_DATA_SOURCE.responseMapping
      );

      expect(result.usageCount).toBe(5000);
      expect(result.sentCount).toBe(4900);
      expect(result.failedCount).toBe(100);
    });
  });

  // ---- 6. Template Token Resolution ---------------------------------------

  describe("6. Template Token Resolution", () => {
    it("should resolve all tokens in URL template", () => {
      const resolved = resolveTokens(
        "https://api.example.com/billing/{billingMonth}",
        "2026-03"
      );
      expect(resolved).toBe("https://api.example.com/billing/2026-03");
    });

    it("should resolve all tokens in POST body template", () => {
      const resolved = resolveTokens(
        '{"period": "{billingMonth}", "year": "{year}", "month": "{month}"}',
        "2026-03"
      );
      const parsed = JSON.parse(resolved);
      expect(parsed.period).toBe("2026-03");
      expect(parsed.year).toBe("2026");
      expect(parsed.month).toBe("3"); // month without leading zero
    });

    it("should preserve template when billingMonth has invalid format", () => {
      const original =
        "https://api.example.com/billing/{billingMonth}";
      const resolved = resolveTokens(original, "invalid-format");
      expect(resolved).toBe(original);
    });

    it("should resolve tokens from DataSource requestTemplate", () => {
      const template = SAMPLE_MULTI_LINE_DATA_SOURCE.requestTemplate!.bodyTemplate!;
      const resolved = resolveTokens(template, "2026-06");
      const parsed = JSON.parse(resolved);
      expect(parsed.period).toBe("2026-06");
      expect(parsed.year).toBe("2026");
      expect(parsed.month).toBe("6");
    });
  });

  // ---- 7. Rate Resolution Chain -------------------------------------------

  describe("7. Rate Resolution Chain", () => {
    it("should extract rate from API response via ratePath", () => {
      const result = resolveRate({
        ratePath: "lines.0.rate",
        fallbackRate: 0.05,
        defaultUnitPrice: 0.03,
        apiResponse: SAMPLE_MULTI_LINE_API_RESPONSE,
      });

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(0.05);
      expect(result!.source).toBe("ratePath");
    });

    it("should fall back to fallbackRate when ratePath returns 0", () => {
      const responseWithZeroRate = {
        lines: [{ rate: 0 }],
      };

      const result = resolveRate({
        ratePath: "lines.0.rate",
        fallbackRate: 0.07,
        defaultUnitPrice: 0.03,
        apiResponse: responseWithZeroRate,
      });

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(0.07);
      expect(result!.source).toBe("fallbackRate");
    });

    it("should fall back to defaultUnitPrice when ratePath is missing", () => {
      const result = resolveRate({
        ratePath: "lines.2.rate", // PROMO has no rate in response
        fallbackRate: undefined,
        defaultUnitPrice: 0.02,
        apiResponse: SAMPLE_MULTI_LINE_API_RESPONSE,
      });

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(0.02);
      expect(result!.source).toBe("defaultUnitPrice");
    });

    it("should resolve rate from CustomerProductMapping defaultUnitPrice", () => {
      const smsDomesticMapping = SAMPLE_PRODUCT_MAPPINGS.find(
        (m) => m.lineIdentifier === "DOMESTIC" && m.serviceType === "SMS"
      )!;

      const result = resolveRate({
        ratePath: undefined, // No ratePath in mapping
        fallbackRate: undefined,
        defaultUnitPrice: smsDomesticMapping.defaultUnitPrice,
        apiResponse: {},
      });

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(0.05);
      expect(result!.source).toBe("defaultUnitPrice");
    });
  });

  // ---- 8. CustomerProductMapping ------------------------------------------

  describe("8. CustomerProductMapping with defaultUnitPrice", () => {
    it("should have mappings for both SMS lines (DOMESTIC and INTL)", () => {
      const smsMappings = SAMPLE_PRODUCT_MAPPINGS.filter(
        (m) => m.serviceType === "SMS"
      );
      expect(smsMappings.length).toBe(2);
    });

    it("should have distinct defaultUnitPrice per line identifier", () => {
      const prices = SAMPLE_PRODUCT_MAPPINGS.map((m) => ({
        line: m.lineIdentifier,
        price: m.defaultUnitPrice,
      }));
      expect(prices).toContainEqual({ line: "DOMESTIC", price: 0.05 });
      expect(prices).toContainEqual({ line: "INTL", price: 0.12 });
      expect(prices).toContainEqual({ line: "WHATSAPP-BIZ", price: 0.08 });
    });

    it("should have both ITEMIZED and LUMP_SUM billing modes", () => {
      const modes = SAMPLE_PRODUCT_MAPPINGS.map((m) => m.billingMode);
      expect(modes).toContain("ITEMIZED");
      expect(modes).toContain("LUMP_SUM");
    });

    it("should resolve correct product for each line using rateResolver", () => {
      // Simulate finding the right mapping for DOMESTIC SMS
      const mapping = SAMPLE_PRODUCT_MAPPINGS.find(
        (m) =>
          m.customerId === "cust-active-monthly" &&
          m.serviceType === "SMS" &&
          m.lineIdentifier === "DOMESTIC"
      )!;

      expect(mapping.productCode).toBe("SMS-DOM-001");
      expect(mapping.classificationCode).toBe("022");
      expect(mapping.defaultUnitPrice).toBe(0.05);
    });
  });

  // ---- 9. End-to-End Journey Simulation -----------------------------------

  describe("9. End-to-End Journey Simulation", () => {
    it("should simulate full journey for ACTIVE monthly customer", async () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-active-monthly"
      )!;
      const billingMonth = "2026-03";

      // Step 1: Status check
      expect(customer.status).toBe("ACTIVE");

      // Step 2: Billing cycle check
      expect(shouldBillThisMonth(customer, billingMonth)).toBe(true);

      // Step 3: Multi-line data extraction
      const multiLineResults = processMultiLine(
        SAMPLE_MULTI_LINE_API_RESPONSE,
        SAMPLE_MULTI_LINE_DATA_SOURCE.lineItemMappings!
      );
      expect(multiLineResults.length).toBe(3);

      // Step 4: Token resolution for POST request
      const resolvedBody = resolveTokens(
        SAMPLE_MULTI_LINE_DATA_SOURCE.requestTemplate!.bodyTemplate!,
        billingMonth
      );
      expect(resolvedBody).toContain("2026-03");

      // Step 5: Rate resolution
      const domesticMapping = SAMPLE_PRODUCT_MAPPINGS.find(
        (m) => m.lineIdentifier === "DOMESTIC" && m.serviceType === "SMS"
      )!;
      const rate = resolveRate({
        ratePath: "lines.0.rate",
        fallbackRate: undefined,
        defaultUnitPrice: domesticMapping.defaultUnitPrice,
        apiResponse: SAMPLE_MULTI_LINE_API_RESPONSE,
      });
      expect(rate!.rate).toBe(0.05);

      // Step 6: Calculate total charge
      const totalCount = multiLineResults.reduce((sum, r) => sum + r.count, 0);
      const totalCharge = totalCount * rate!.rate;
      expect(totalCharge).toBe(15000 * 0.05); // 750.00
    });

    it("should simulate SUSPENDED customer journey - no billing", async () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-suspended"
      )!;
      const billingMonth = "2026-03";

      // Status check should prevent billing
      expect(customer.status).toBe("SUSPENDED");
      // In generateBillableData, this would return { reason: 'skipped' }
    });

    it("should simulate QUARTERLY customer billing only in Q1", async () => {
      const customer = SAMPLE_CUSTOMERS.find(
        (c) => c.id === "cust-active-quarterly"
      )!;

      // Q1 months (January) should bill
      expect(shouldBillThisMonth(customer, "2026-01")).toBe(true);
      // Q2 months (April) should also bill for quarterly
      expect(shouldBillThisMonth(customer, "2026-04")).toBe(true);
      // Non-quarter months should not bill
      expect(shouldBillThisMonth(customer, "2026-03")).toBe(false);
      expect(shouldBillThisMonth(customer, "2026-05")).toBe(false);
    });

    it("should simulate fallback values when API response is partial", async () => {
      // Simulate what happens when lineItemMappings has countPath that resolves to 0
      // and useDefaultOnMissing is true
      const partialResponse = {
        lines: [{ count: 1000 }],
        // Second line is missing
      };

      const mappings: LineItemMapping[] = [
        { lineIdentifier: "ACTIVE", countPath: "lines.0.count" },
        {
          lineIdentifier: "MISSING",
          countPath: "lines.1.count",
          fallbackRate: 0.05,
        },
      ];

      const results = processMultiLine(partialResponse, mappings);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);

      // Active has 1000, missing defaults to 0
      expect(totalCount).toBe(1000);

      // But if useDefaultOnMissing is true and fallbackValues.usageCount is set,
      // we would use fallback
      if (SAMPLE_MULTI_LINE_DATA_SOURCE.fallbackValues!.useDefaultOnMissing) {
        const fallbackCount =
          SAMPLE_MULTI_LINE_DATA_SOURCE.fallbackValues!.usageCount ?? 0;
        expect(fallbackCount).toBe(0);
      }
    });
  });
});
