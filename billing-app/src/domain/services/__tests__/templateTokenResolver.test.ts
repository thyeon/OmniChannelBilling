import { resolveTokens } from "../templateTokenResolver";

describe("templateTokenResolver", () => {
  describe("resolveTokens", () => {
    it("should resolve {billingMonth} token", () => {
      const result = resolveTokens("period={billingMonth}", "2026-03");
      expect(result).toBe("period=2026-03");
    });

    it("should resolve {month} token without leading zero", () => {
      const result = resolveTokens('{"month": "{month}"}', "2026-03");
      expect(result).toBe('{"month": "3"}');
    });

    it("should resolve {year} token", () => {
      const result = resolveTokens("year={year}", "2026-03");
      expect(result).toBe("year=2026");
    });

    it("should resolve all tokens in a URL", () => {
      const result = resolveTokens(
        "https://api.example.com?from={year}-01-01&to={billingMonth}-31",
        "2026-03"
      );
      expect(result).toBe("https://api.example.com?from=2026-01-01&to=2026-03-31");
    });

    it("should resolve all tokens in a JSON template", () => {
      const result = resolveTokens(
        '{"month": "{month}", "year": "{year}", "period": "{billingMonth}"}',
        "2026-03"
      );
      expect(result).toBe('{"month": "3", "year": "2026", "period": "2026-03"}');
    });

    it("should handle month with leading zero in input (January)", () => {
      const result = resolveTokens("{month}", "2026-01");
      expect(result).toBe("1");
    });

    it("should handle December", () => {
      const result = resolveTokens("{month}", "2026-12");
      expect(result).toBe("12");
    });

    it("should return template unchanged for invalid billingMonth format", () => {
      const template = "period={billingMonth}";
      const result = resolveTokens(template, "invalid");
      expect(result).toBe(template);
    });

    it("should return template unchanged for empty billingMonth", () => {
      const template = "period={billingMonth}";
      const result = resolveTokens(template, "");
      expect(result).toBe(template);
    });

    it("should return template unchanged for billingMonth without dash", () => {
      const template = "period={billingMonth}";
      const result = resolveTokens(template, "202603");
      expect(result).toBe(template);
    });

    it("should return template unchanged for billingMonth with invalid month", () => {
      const template = "period={billingMonth}";
      const result = resolveTokens(template, "2026-13");
      expect(result).toBe(template);
    });

    it("should handle template with no tokens", () => {
      const result = resolveTokens("https://api.example.com/data", "2026-03");
      expect(result).toBe("https://api.example.com/data");
    });

    it("should handle multiple occurrences of the same token", () => {
      const result = resolveTokens(
        "start={billingMonth}&end={billingMonth}",
        "2026-03"
      );
      expect(result).toBe("start=2026-03&end=2026-03");
    });
  });
});
