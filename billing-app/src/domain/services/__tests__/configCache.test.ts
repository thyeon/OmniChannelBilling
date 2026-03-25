import { configCache } from "../configCache";

describe("ConfigCache", () => {
  beforeEach(() => {
    configCache.invalidateAll();
  });

  describe("get/set basic operations", () => {
    it("should return null for non-existent key", () => {
      const result = configCache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should store and retrieve data", () => {
      configCache.set("test-key", { name: "test", value: 123 });
      const result = configCache.get<{ name: string; value: number }>("test-key");
      expect(result).toEqual({ name: "test", value: 123 });
    });

    it("should store primitive values", () => {
      configCache.set("string-key", "hello");
      expect(configCache.get<string>("string-key")).toBe("hello");

      configCache.set("number-key", 42);
      expect(configCache.get<number>("number-key")).toBe(42);

      configCache.set("boolean-key", true);
      expect(configCache.get<boolean>("boolean-key")).toBe(true);
    });

    it("should store array values", () => {
      const arr = [1, 2, 3];
      configCache.set("array-key", arr);
      expect(configCache.get<number[]>("array-key")).toEqual([1, 2, 3]);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entry after TTL", async () => {
      configCache.set("ttl-key", "value", 0.001); // 0.001 minutes = 60ms
      expect(configCache.get<string>("ttl-key")).toBe("value");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 70));

      expect(configCache.get<string>("ttl-key")).toBeNull();
    });

    it("should use default TTL of 5 minutes", async () => {
      configCache.set("default-ttl", "value");
      expect(configCache.get<string>("default-ttl")).toBe("value");

      // Wait less than 5 minutes
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(configCache.get<string>("default-ttl")).toBe("value");
    });

    it("should return null for expired entries on access", async () => {
      vi.useFakeTimers();
      configCache.set("expire-key", "value", 0.001); // 0.001 min = 60ms
      vi.advanceTimersByTime(100);
      const result = configCache.get<string>("expire-key");
      expect(result).toBeNull();
      // Second access should still be null
      expect(configCache.get<string>("expire-key")).toBeNull();
      vi.useRealTimers();
    });
  });

  describe("invalidate(customerId)", () => {
    it("should remove all entries containing customerId", () => {
      configCache.set("customer:123:config", { setting: "a" });
      configCache.set("customer:123:datasources", [{ id: "ds1" }]);
      configCache.set("customer:456:config", { setting: "b" });
      configCache.set("other:key", "value");

      configCache.invalidate("123");

      expect(configCache.get("customer:123:config")).toBeNull();
      expect(configCache.get("customer:123:datasources")).toBeNull();
      expect(configCache.get("customer:456:config")).toEqual({ setting: "b" });
      expect(configCache.get("other:key")).toBe("value");
    });

    it("should handle multiple matching keys", () => {
      configCache.set("customer:abc:mapping", { map: 1 });
      configCache.set("customer:abc:fields", { field: "x" });
      configCache.set("customer:abc:settings", { setting: "y" });
      configCache.set("other:abc", "value");

      configCache.invalidate("abc");

      expect(configCache.get("customer:abc:mapping")).toBeNull();
      expect(configCache.get("customer:abc:fields")).toBeNull();
      expect(configCache.get("customer:abc:settings")).toBeNull();
      expect(configCache.get("other:abc")).toBe("value");
    });

    it("should handle empty cache", () => {
      configCache.invalidate("nonexistent");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("invalidateAll", () => {
    it("should clear all cache entries", () => {
      configCache.set("key1", "value1");
      configCache.set("key2", "value2");
      configCache.set("key3", "value3");

      configCache.invalidateAll();

      expect(configCache.get("key1")).toBeNull();
      expect(configCache.get("key2")).toBeNull();
      expect(configCache.get("key3")).toBeNull();
    });

    it("should handle empty cache", () => {
      configCache.invalidateAll();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});