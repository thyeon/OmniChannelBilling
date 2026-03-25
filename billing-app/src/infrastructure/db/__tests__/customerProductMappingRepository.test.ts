import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are created before any hoisting
const { mockCollection, mockDb, mockGetDatabase } = vi.hoisted(() => {
  const mockCollection = {
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'test-id' }),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
  };

  const mockGetDatabase = vi.fn().mockResolvedValue(mockDb);

  return { mockCollection, mockDb, mockGetDatabase };
});

// Mock the mongodb module
vi.mock('./mongodb', () => ({
  getDatabase: mockGetDatabase,
}));

// Import after mock is set up
import {
  createCustomerProductMapping,
  findCustomerProductMappingsByCustomerId,
  findCustomerProductMappingById,
  findCustomerProductMappingByKey,
  updateCustomerProductMapping,
  deleteCustomerProductMapping,
} from '../customerProductMappingRepository';

describe('customerProductMappingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    mockCollection.insertOne.mockResolvedValue({ insertedId: 'test-id' });
    mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.findOneAndUpdate.mockResolvedValue(null);
    mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });
  });

  describe('createCustomerProductMapping', () => {
    it('returns mapping with id and timestamps', async () => {
      const input = {
        customerId: 'cust-123',
        serviceType: 'SMS' as const,
        lineIdentifier: 'DOMESTIC',
        productCode: 'SMS-001',
        description: 'SMS Service',
        furtherDescriptionTemplate: 'template',
        classificationCode: 'CLS-001',
        unit: 'per_sms',
        taxCode: 'TAX-001',
        billingMode: 'ITEMIZED' as const,
        defaultUnitPrice: 0.05,
      };

      const result = await createCustomerProductMapping(input);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(result.customerId).toBe('cust-123');
      expect(result.id).toMatch(/^cpm-/);
    });
  });

  describe('findCustomerProductMappingsByCustomerId', () => {
    it('returns array of mappings', async () => {
      const mockDocs = [
        { _id: '1', id: 'cpm-1', customerId: 'cust-123', serviceType: 'SMS', lineIdentifier: 'DOMESTIC', productCode: 'SMS-001', description: 'SMS Service', furtherDescriptionTemplate: 'template', classificationCode: 'CLS-001', unit: 'per_sms', taxCode: 'TAX-001', billingMode: 'ITEMIZED', defaultUnitPrice: 0.05, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        { _id: '2', id: 'cpm-2', customerId: 'cust-123', serviceType: 'EMAIL', lineIdentifier: 'INTL', productCode: 'EMAIL-001', description: 'Email Service', furtherDescriptionTemplate: 'template', classificationCode: 'CLS-002', unit: 'per_email', taxCode: 'TAX-002', billingMode: 'ITEMIZED', defaultUnitPrice: 0.10, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ];

      mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue(mockDocs) });

      const result = await findCustomerProductMappingsByCustomerId('cust-123');

      expect(result).toHaveLength(2);
      expect(result[0].customerId).toBe('cust-123');
      expect(result[1].customerId).toBe('cust-123');
    });

    it('returns empty array when no mappings found', async () => {
      mockCollection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await findCustomerProductMappingsByCustomerId('cust-999');

      expect(result).toHaveLength(0);
    });
  });

  describe('findCustomerProductMappingById', () => {
    it('returns mapping when found', async () => {
      const mockDoc = {
        _id: '1',
        id: 'cpm-123',
        customerId: 'cust-123',
        serviceType: 'SMS',
        lineIdentifier: 'DOMESTIC',
        productCode: 'SMS-001',
        description: 'SMS Service',
        furtherDescriptionTemplate: 'template',
        classificationCode: 'CLS-001',
        unit: 'per_sms',
        taxCode: 'TAX-001',
        billingMode: 'ITEMIZED',
        defaultUnitPrice: 0.05,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockCollection.findOne.mockResolvedValue(mockDoc);

      const result = await findCustomerProductMappingById('cpm-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('cpm-123');
    });

    it('returns null when not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await findCustomerProductMappingById('cpm-999');

      expect(result).toBeNull();
    });
  });

  describe('findCustomerProductMappingByKey', () => {
    it('returns null when not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await findCustomerProductMappingByKey('cust-123', 'SMS', 'DOMESTIC');

      expect(result).toBeNull();
    });
  });

  describe('updateCustomerProductMapping', () => {
    it('returns null for non-existent id', async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue(null);

      const result = await updateCustomerProductMapping('cpm-999', { productCode: 'NEW-001' });

      expect(result).toBeNull();
    });
  });

  describe('deleteCustomerProductMapping', () => {
    it('returns false for non-existent id', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await deleteCustomerProductMapping('cpm-999');

      expect(result).toBe(false);
    });
  });
});