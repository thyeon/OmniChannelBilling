/**
 * Tests for RateResolver service
 */

import { resolveRate, RateResolutionInput } from "../rateResolver";

describe("resolveRate", () => {
  describe("Rate resolved from ratePath", () => {
    it("should resolve rate from apiResponse using ratePath", () => {
      const input: RateResolutionInput = {
        ratePath: "data.rate",
        fallbackRate: undefined,
        defaultUnitPrice: undefined,
        apiResponse: {
          data: {
            rate: 0.5,
          },
        },
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.5);
      expect(result?.source).toBe("ratePath");
    });

    it("should resolve rate from nested path in apiResponse", () => {
      const input: RateResolutionInput = {
        ratePath: "items.0.price",
        apiResponse: {
          items: [
            { price: 1.25 },
          ],
        },
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(1.25);
      expect(result?.source).toBe("ratePath");
    });

    it("should not use ratePath value if it is zero", () => {
      const input: RateResolutionInput = {
        ratePath: "data.rate",
        fallbackRate: 0.3,
        defaultUnitPrice: 0.1,
        apiResponse: {
          data: {
            rate: 0,
          },
        },
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.3);
      expect(result?.source).toBe("fallbackRate");
    });
  });

  describe("Falls back to fallbackRate when ratePath absent", () => {
    it("should fall back to fallbackRate when ratePath is not provided", () => {
      const input: RateResolutionInput = {
        ratePath: undefined,
        fallbackRate: 0.75,
        defaultUnitPrice: 0.2,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.75);
      expect(result?.source).toBe("fallbackRate");
    });

    it("should fall back to fallbackRate when ratePath value is undefined", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: 0.8,
        defaultUnitPrice: 0.25,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.8);
      expect(result?.source).toBe("fallbackRate");
    });

    it("should fall back to fallbackRate when ratePath value is null", () => {
      const input: RateResolutionInput = {
        ratePath: "data.rate",
        fallbackRate: 0.85,
        defaultUnitPrice: 0.3,
        apiResponse: {
          data: {
            rate: null,
          },
        },
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.85);
      expect(result?.source).toBe("fallbackRate");
    });
  });

  describe("Falls back to defaultUnitPrice when fallbackRate absent", () => {
    it("should fall back to defaultUnitPrice when fallbackRate is undefined", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: undefined,
        defaultUnitPrice: 0.5,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.5);
      expect(result?.source).toBe("defaultUnitPrice");
    });

    it("should fall back to defaultUnitPrice when fallbackRate is null", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: null,
        defaultUnitPrice: 0.6,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.6);
      expect(result?.source).toBe("defaultUnitPrice");
    });

    it("should fall back to defaultUnitPrice when fallbackRate is zero", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: 0,
        defaultUnitPrice: 0.7,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.7);
      expect(result?.source).toBe("defaultUnitPrice");
    });
  });

  describe("Returns null when no rate available", () => {
    it("should return null when all options are undefined", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: undefined,
        defaultUnitPrice: undefined,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).toBeNull();
    });

    it("should return null when all options are null", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: null,
        defaultUnitPrice: null,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).toBeNull();
    });

    it("should return null when fallbackRate is zero and defaultUnitPrice is zero", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: 0,
        defaultUnitPrice: 0,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).toBeNull();
    });

    it("should return null when only fallbackRate is zero", () => {
      const input: RateResolutionInput = {
        ratePath: "nonexistent.path",
        fallbackRate: 0,
        defaultUnitPrice: undefined,
        apiResponse: {},
      };

      const result = resolveRate(input);

      expect(result).toBeNull();
    });
  });
});
