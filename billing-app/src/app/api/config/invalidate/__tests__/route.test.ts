import { NextRequest } from "next/server";
import { POST } from "../route";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the configurationService
vi.mock("@/domain/services/configurationService", () => ({
  invalidateCustomerCache: vi.fn(),
}));

import { invalidateCustomerCache } from "@/domain/services/configurationService";

const mockInvalidateCustomerCache = invalidateCustomerCache as ReturnType<typeof vi.fn>;

describe("POST /api/config/invalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if customerId is missing", async () => {
    const request = new NextRequest("http://localhost/api/config/invalidate", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("customerId is required");
  });

  it("should return 400 if request body is empty", async () => {
    const request = new NextRequest("http://localhost/api/config/invalidate", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("customerId is required");
  });

  it("should return success if invalidation succeeds", async () => {
    mockInvalidateCustomerCache.mockResolvedValue();

    const request = new NextRequest("http://localhost/api/config/invalidate", {
      method: "POST",
      body: JSON.stringify({ customerId: "cust-123" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockInvalidateCustomerCache).toHaveBeenCalledWith("cust-123");
  });

  it("should return 500 if invalidation fails", async () => {
    mockInvalidateCustomerCache.mockRejectedValue(new Error("Cache error"));

    const request = new NextRequest("http://localhost/api/config/invalidate", {
      method: "POST",
      body: JSON.stringify({ customerId: "cust-123" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Failed to invalidate cache");
  });
});
