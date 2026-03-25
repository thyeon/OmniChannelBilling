import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encrypt, decrypt, maskCredential } from "../credentialEncryptionService";

describe("credentialEncryptionService", () => {
  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  });

  describe("encrypt", () => {
    it("should encrypt a plaintext string", () => {
      const plaintext = "my-secret-api-key";
      const ciphertext = encrypt(plaintext);

      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).toContain(":");
    });

    it("should produce different ciphertext each time (due to random IV)", () => {
      const plaintext = "my-secret-api-key";
      const ciphertext1 = encrypt(plaintext);
      const ciphertext2 = encrypt(plaintext);

      expect(ciphertext1).not.toBe(ciphertext2);
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted text back to original plaintext", () => {
      const plaintext = "my-secret-api-key";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle roundtrip with various inputs", () => {
      const testCases = [
        "simplepassword",
        "complex-api-key-123456789",
        "short",
        "a",
        "special!@#$%^&*()characters",
        "unicode: กขฃ",
      ];

      testCases.forEach((plaintext) => {
        const ciphertext = encrypt(plaintext);
        const decrypted = decrypt(ciphertext);
        expect(decrypted).toBe(plaintext);
      });
    });

    it("should throw error for invalid ciphertext format", () => {
      expect(() => decrypt("invalid")).toThrow("Invalid ciphertext format");
      expect(() => decrypt("a:b")).toThrow("Invalid ciphertext format");
    });
  });

  describe("maskCredential", () => {
    it("should show last 4 characters", () => {
      expect(maskCredential("secretkey1234")).toBe("****1234");
    });

    it("should return **** for credential <= 4 chars", () => {
      expect(maskCredential("abcd")).toBe("****");
      expect(maskCredential("abc")).toBe("****");
      expect(maskCredential("ab")).toBe("****");
      expect(maskCredential("a")).toBe("****");
      expect(maskCredential("")).toBe("****");
    });

    it("should handle long credentials", () => {
      const longCred = "very-long-credential-string";
      const masked = maskCredential(longCred);
      expect(masked).toBe("****ring");
      expect(masked.length).toBe(8); // 4 asterisks + 4 last chars
    });
  });

  describe("getKey", () => {
    it("should throw when CREDENTIAL_ENCRYPTION_KEY is not set", () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow(
        "CREDENTIAL_ENCRYPTION_KEY environment variable is not set"
      );
      expect(() => decrypt("abc:def:ghi")).toThrow(
        "CREDENTIAL_ENCRYPTION_KEY environment variable is not set"
      );
    });
  });
});
