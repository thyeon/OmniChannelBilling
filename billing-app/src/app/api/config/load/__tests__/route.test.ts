import { NextRequest } from "next/server";
import { GET } from "../route";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the configurationService
vi.mock("@/domain/services/configurationService", () => ({
  loadCustomerConfig: vi.fn(),
}));

import { loadCustomerConfig } from "@/domain/services/configurationService";

const mockLoadCustomerConfig = loadCustomerConfig as ReturnType<typeof vi.fn>;

describe("GET /api/config/load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if customerId is missing", async () => {
    const request = new NextRequest(new URL("http://localhost/api/config/load"));
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("customerId is required");
  });

  it("should return 404 if customer config not found", async () => {
    mockLoadCustomerConfig.mockResolvedValue(null);

    const request = new NextRequest(
      new URL("http://localhost/api/config/load?customerId=cust-123")
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Customer not found");
  });

  it("should return config if customer found", async () => {
    const mockConfig = { id: "cust-123", name: "Test Customer" };
    mockLoadCustomerConfig.mockResolvedValue(mockConfig);

    const request = new NextRequest(
      new URL("http://localhost/api/config/load?customerId=cust-123")
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.config).toEqual(mockConfig);
  });

  it("should return 500 if loading config fails", async () => {
    mockLoadCustomerConfig.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest(
      new URL("http://localhost/api/config/load?customerId=cust-123")
    );
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to load config");
  });
});
