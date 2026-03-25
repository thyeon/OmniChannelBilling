/**
 * Configuration Service Tests
 *
 * Tests for the ConfigurationService which handles customer config loading and caching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadCustomerConfig,
  invalidateCustomerCache,
} from '../configurationService';

// Mock the dependencies
vi.mock('../configCache', () => ({
  configCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

vi.mock('@/infrastructure/db/customerRepository', () => ({
  findCustomerById: vi.fn(),
}));

vi.mock('@/infrastructure/db/dataSourceRepository', () => ({
  findActiveDataSourcesByCustomerId: vi.fn(),
}));

vi.mock('../credentialEncryptionService', () => ({
  maskCredential: vi.fn((value: string) => '****' + value.slice(-4)),
}));

// Import after mocking
import { configCache } from '../configCache';
import { findCustomerById } from '@/infrastructure/db/customerRepository';
import { findActiveDataSourcesByCustomerId } from '@/infrastructure/db/dataSourceRepository';
import { maskCredential } from '../credentialEncryptionService';

describe('ConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadCustomerConfig', () => {
    it('should return cached config if available', async () => {
      const cachedConfig = {
        customer: { id: 'cust-123', name: 'Test Customer' },
        dataSources: [],
        loadedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(configCache.get).mockReturnValue(cachedConfig);

      const result = await loadCustomerConfig('cust-123');

      expect(result).toEqual(cachedConfig);
      expect(configCache.get).toHaveBeenCalledWith('customer:cust-123');
      expect(findCustomerById).not.toHaveBeenCalled();
    });

    it('should return null if customer not found', async () => {
      vi.mocked(configCache.get).mockReturnValue(null);
      vi.mocked(findCustomerById).mockResolvedValue(null);

      const result = await loadCustomerConfig('non-existent');

      expect(result).toBeNull();
      expect(findCustomerById).toHaveBeenCalledWith('non-existent');
    });

    it('should load config from database and cache it', async () => {
      const mockCustomer = { id: 'cust-123', name: 'Test Customer' };
      const mockDataSources = [
        {
          id: 'ds-1',
          customerId: 'cust-123',
          type: 'CUSTOM_REST_API',
          serviceType: 'SMS',
          name: 'Test DS',
          apiEndpoint: 'https://api.test.com',
          authType: 'API_KEY',
          authCredentials: { key: 'secret-key-123' },
          responseMapping: { usageCountPath: 'data.usage' },
          isActive: true,
        },
      ];

      vi.mocked(configCache.get).mockReturnValue(null);
      vi.mocked(findCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(findActiveDataSourcesByCustomerId).mockResolvedValue(mockDataSources as any);

      const result = await loadCustomerConfig('cust-123');

      expect(result).not.toBeNull();
      expect(result?.customer).toEqual(mockCustomer);
      expect(result?.dataSources).toHaveLength(1);
      expect(result?.dataSources[0].maskedCredentials).toEqual({ key: '****-123' });
      expect(configCache.set).toHaveBeenCalledWith('customer:cust-123', expect.any(Object), 5);
    });

    it('should handle data sources without credentials', async () => {
      const mockCustomer = { id: 'cust-123', name: 'Test Customer' };
      const mockDataSources = [
        {
          id: 'ds-1',
          customerId: 'cust-123',
          type: 'CUSTOM_REST_API',
          serviceType: 'SMS',
          name: 'Test DS',
          apiEndpoint: 'https://api.test.com',
          authType: 'NONE',
          responseMapping: { usageCountPath: 'data.usage' },
          isActive: true,
        },
      ];

      vi.mocked(configCache.get).mockReturnValue(null);
      vi.mocked(findCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(findActiveDataSourcesByCustomerId).mockResolvedValue(mockDataSources as any);

      const result = await loadCustomerConfig('cust-123');

      expect(result).not.toBeNull();
      expect(result?.dataSources[0].maskedCredentials).toBeUndefined();
    });
  });

  describe('invalidateCustomerCache', () => {
    it('should call cache invalidation', async () => {
      vi.mocked(configCache.invalidate).mockImplementation(() => {});

      await invalidateCustomerCache('cust-123');

      expect(configCache.invalidate).toHaveBeenCalledWith('cust-123');
    });
  });
});