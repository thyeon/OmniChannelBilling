import { processMultiLine, processLegacySingleLine } from "../lineItemProcessor";

describe("lineItemProcessor", () => {
  describe("processMultiLine", () => {
    it("should extract count and rate for single line mapping", () => {
      const apiResponse = {
        data: {
          sms_count: 100,
          sms_rate: 0.05,
        },
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "data.sms_count", ratePath: "data.sms_rate" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 100, rate: 0.05, fallbackRate: undefined },
      ]);
    });

    it("should extract multiple line items", () => {
      const apiResponse = {
        data: {
          sms: { count: 50 },
          whatsapp: { count: 30 },
          email: { count: 20 },
        },
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "data.sms.count" },
        { lineIdentifier: "WHATSAPP", countPath: "data.whatsapp.count" },
        { lineIdentifier: "EMAIL", countPath: "data.email.count" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 50, rate: undefined, fallbackRate: undefined },
        { lineIdentifier: "WHATSAPP", count: 30, rate: undefined, fallbackRate: undefined },
        { lineIdentifier: "EMAIL", count: 20, rate: undefined, fallbackRate: undefined },
      ]);
    });

    it("should handle array index notation in paths", () => {
      const apiResponse = {
        items: [
          { type: "sms", quantity: 75 },
          { type: "whatsapp", quantity: 25 },
        ],
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "items.0.quantity" },
        { lineIdentifier: "WHATSAPP", countPath: "items.1.quantity" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 75, rate: undefined, fallbackRate: undefined },
        { lineIdentifier: "WHATSAPP", count: 25, rate: undefined, fallbackRate: undefined },
      ]);
    });

    it("should handle bracket notation in paths", () => {
      const apiResponse = {
        records: [
          { service: "SMS", qty: 100 },
          { service: "WHATSAPP", qty: 50 },
        ],
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "records[0].qty" },
        { lineIdentifier: "WHATSAPP", countPath: "records[1].qty" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 100, rate: undefined, fallbackRate: undefined },
        { lineIdentifier: "WHATSAPP", count: 50, rate: undefined, fallbackRate: undefined },
      ]);
    });

    it("should return 0 count when path not found", () => {
      const apiResponse = {
        data: {
          sms: 100,
        },
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "data.missing" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 0, rate: undefined, fallbackRate: undefined },
      ]);
    });

    it("should handle fallbackRate", () => {
      const apiResponse = {
        data: {
          sms: 100,
        },
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "data.sms", fallbackRate: 0.1 },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 100, rate: undefined, fallbackRate: 0.1 },
      ]);
    });

    it("should return undefined for rate when ratePath not provided", () => {
      const apiResponse = {
        data: {
          sms: 100,
        },
      };

      const result = processMultiLine(apiResponse, [
        { lineIdentifier: "SMS", countPath: "data.sms" },
      ]);

      expect(result[0].rate).toBeUndefined();
    });

    it("should handle empty apiResponse", () => {
      const result = processMultiLine({}, [
        { lineIdentifier: "SMS", countPath: "data.sms" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 0, rate: undefined, fallbackRate: undefined },
      ]);
    });

    it("should handle null apiResponse", () => {
      const result = processMultiLine(null, [
        { lineIdentifier: "SMS", countPath: "data.sms" },
      ]);

      expect(result).toEqual([
        { lineIdentifier: "SMS", count: 0, rate: undefined, fallbackRate: undefined },
      ]);
    });
  });

  describe("processLegacySingleLine", () => {
    it("should extract usageCount from API response", () => {
      const apiResponse = {
        result: {
          total_count: 250,
        },
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "result.total_count",
      });

      expect(result).toEqual({
        usageCount: 250,
        sentCount: undefined,
        failedCount: undefined,
      });
    });

    it("should extract sentCount and failedCount when provided", () => {
      const apiResponse = {
        data: {
          sent: 200,
          failed: 5,
          total: 205,
        },
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "data.total",
        sentPath: "data.sent",
        failedPath: "data.failed",
      });

      expect(result).toEqual({
        usageCount: 205,
        sentCount: 200,
        failedCount: 5,
      });
    });

    it("should return 0 when usageCountPath not found", () => {
      const apiResponse = {
        data: {},
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "data.missing",
      });

      expect(result).toEqual({
        usageCount: 0,
        sentCount: undefined,
        failedCount: undefined,
      });
    });

    it("should handle array index notation in paths", () => {
      const apiResponse = {
        items: [{ count: 150 }],
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "items.0.count",
      });

      expect(result).toEqual({
        usageCount: 150,
        sentCount: undefined,
        failedCount: undefined,
      });
    });

    it("should handle nested object paths", () => {
      const apiResponse = {
        response: {
          billing: {
            usage: {
              total: 300,
            },
          },
        },
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "response.billing.usage.total",
      });

      expect(result).toEqual({
        usageCount: 300,
        sentCount: undefined,
        failedCount: undefined,
      });
    });

    it("should return undefined for sentCount when sentPath not provided", () => {
      const apiResponse = {
        data: {
          total: 100,
        },
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "data.total",
      });

      expect(result.sentCount).toBeUndefined();
    });

    it("should return undefined for failedCount when failedPath not provided", () => {
      const apiResponse = {
        data: {
          total: 100,
        },
      };

      const result = processLegacySingleLine(apiResponse, {
        usageCountPath: "data.total",
      });

      expect(result.failedCount).toBeUndefined();
    });

    it("should handle empty apiResponse", () => {
      const result = processLegacySingleLine({}, {
        usageCountPath: "data.total",
      });

      expect(result).toEqual({
        usageCount: 0,
        sentCount: undefined,
        failedCount: undefined,
      });
    });

    it("should handle null apiResponse", () => {
      const result = processLegacySingleLine(null, {
        usageCountPath: "data.total",
      });

      expect(result).toEqual({
        usageCount: 0,
        sentCount: undefined,
        failedCount: undefined,
      });
    });
  });
});