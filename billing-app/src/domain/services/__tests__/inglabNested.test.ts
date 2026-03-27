import { processInglabNested } from "../lineItemProcessor";
import { NestedResponseConfig } from "@/domain/models/dataSource";

describe("processInglabNested", () => {
  const baseConfig: NestedResponseConfig = {
    itemsPath: "items",
    lineItemsPath: "line_items",
    descriptionPath: "description",
    descriptionDetailPath: "description_detail",
    qtyPath: "qty",
    unitPricePath: "unit_price",
    servicePath: "service",
  };

  it("should extract all line items from nested INGLAB response", () => {
    const apiResponse = {
      items: [
        {
          service: "WhatsApp Business API",
          line_items: [
            { description: "SMS", description_detail: "ECS SMS Service", qty: 100, unit_price: 0.079 },
            { description: "WhatsApp", description_detail: "ECS WhatsApp Service", qty: 50, unit_price: 0.10 },
          ],
        },
      ],
    };

    const result = processInglabNested(apiResponse, baseConfig);

    expect(result).toEqual([
      { description: "SMS", descriptionDetail: "ECS SMS Service", qty: 100, unitPrice: 0.079, service: "WhatsApp Business API" },
      { description: "WhatsApp", descriptionDetail: "ECS WhatsApp Service", qty: 50, unitPrice: 0.10, service: "WhatsApp Business API" },
    ]);
  });

  it("should handle empty items array", () => {
    const result = processInglabNested({ items: [] }, baseConfig);
    expect(result).toEqual([]);
  });

  it("should handle items array with empty line_items", () => {
    const result = processInglabNested({ items: [{ line_items: [] }] }, baseConfig);
    expect(result).toEqual([]);
  });

  it("should handle missing optional descriptionDetailPath", () => {
    const config: NestedResponseConfig = {
      ...baseConfig,
      descriptionDetailPath: undefined,
    };
    const apiResponse = {
      items: [{ line_items: [{ description: "SMS", qty: 100, unit_price: 0.079 }] }],
    };
    const result = processInglabNested(apiResponse, config);
    expect(result[0].descriptionDetail).toBeUndefined();
  });

  it("should handle zero qty line items", () => {
    const apiResponse = {
      items: [{ line_items: [{ description: "Zero SMS", qty: 0, unit_price: 0.079 }] }],
    };
    const result = processInglabNested(apiResponse, baseConfig);
    expect(result[0].qty).toBe(0);
  });

  it("should return unitPrice = 0 when API returns unit_price = 0", () => {
    const apiResponse = {
      items: [{ line_items: [{ description: "Free SMS", qty: 100, unit_price: 0 }] }],
    };
    const result = processInglabNested(apiResponse, baseConfig);
    expect(result[0].unitPrice).toBe(0);
    expect(result[0].qty).toBe(100);
  });

  it("should return unitPrice = 0 when unit_price field is missing", () => {
    const apiResponse = {
      items: [{ line_items: [{ description: "SMS", qty: 100 }] }],
    };
    const result = processInglabNested(apiResponse, { ...baseConfig });
    expect(result[0].unitPrice).toBe(0);
  });

  it("should use getNestedValue helper for path resolution", () => {
    const apiResponse = {
      data: {
        items: [
          { line_items: [{ description: "Test", qty: 10, unit_price: 0.05 }] },
        ],
      },
    };
    const config: NestedResponseConfig = {
      ...baseConfig,
      itemsPath: "data.items",
      lineItemsPath: "line_items",
    };
    const result = processInglabNested(apiResponse, config);
    expect(result[0].description).toBe("Test");
  });
});
