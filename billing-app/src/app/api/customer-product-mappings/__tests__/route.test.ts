import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { GET as GET_BY_ID, PUT, DELETE } from '../[id]/route';
import { NextRequest } from 'next/server';

// Mock the repository functions
vi.mock('@/infrastructure/db/customerProductMappingRepository', () => ({
  findCustomerProductMappingsByCustomerId: vi.fn(),
  createCustomerProductMapping: vi.fn(),
  findCustomerProductMappingById: vi.fn(),
  updateCustomerProductMapping: vi.fn(),
  deleteCustomerProductMapping: vi.fn(),
}));

import {
  findCustomerProductMappingsByCustomerId,
  createCustomerProductMapping,
  findCustomerProductMappingById,
  updateCustomerProductMapping,
  deleteCustomerProductMapping,
} from '@/infrastructure/db/customerProductMappingRepository';

describe('/api/customer-product-mappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 if customerId is missing', async () => {
      const request = new NextRequest('http://localhost/api/customer-product-mappings');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('customerId');
    });

    it('should return array of mappings when customerId is provided', async () => {
      const mockMappings = [
        { id: 'cpm-1', customerId: 'cust-1', serviceType: 'SMS', lineIdentifier: 'DOMESTIC' },
        { id: 'cpm-2', customerId: 'cust-1', serviceType: 'EMAIL', lineIdentifier: 'INTL' },
      ];
      vi.mocked(findCustomerProductMappingsByCustomerId).mockResolvedValue(mockMappings);

      const request = new NextRequest('http://localhost/api/customer-product-mappings?customerId=cust-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockMappings);
      expect(findCustomerProductMappingsByCustomerId).toHaveBeenCalledWith('cust-1');
    });
  });

  describe('POST', () => {
    it('should return 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost/api/customer-product-mappings', {
        method: 'POST',
        body: JSON.stringify({ customerId: 'cust-1' }), // missing other fields
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 201 and created mapping on success', async () => {
      const input = {
        customerId: 'cust-1',
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
      };

      const createdMapping = { id: 'cpm-123', ...input, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
      vi.mocked(createCustomerProductMapping).mockResolvedValue(createdMapping);

      const request = new NextRequest('http://localhost/api/customer-product-mappings', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(createdMapping);
      expect(createCustomerProductMapping).toHaveBeenCalledWith(input);
    });
  });
});

describe('/api/customer-product-mappings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 404 if mapping not found', async () => {
      vi.mocked(findCustomerProductMappingById).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-999');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'cpm-999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return mapping when found', async () => {
      const mapping = { id: 'cpm-1', customerId: 'cust-1', serviceType: 'SMS' };
      vi.mocked(findCustomerProductMappingById).mockResolvedValue(mapping);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-1');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'cpm-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mapping);
    });
  });

  describe('PUT', () => {
    it('should return 404 if mapping not found', async () => {
      vi.mocked(updateCustomerProductMapping).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-999', {
        method: 'PUT',
        body: JSON.stringify({ defaultUnitPrice: 0.10 }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'cpm-999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
    });

    it('should return updated mapping on success', async () => {
      const updated = { id: 'cpm-1', defaultUnitPrice: 0.10 };
      vi.mocked(updateCustomerProductMapping).mockResolvedValue(updated);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-1', {
        method: 'PUT',
        body: JSON.stringify({ defaultUnitPrice: 0.10 }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'cpm-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(updated);
    });
  });

  describe('DELETE', () => {
    it('should return 404 if mapping not found', async () => {
      vi.mocked(deleteCustomerProductMapping).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-999', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'cpm-999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
    });

    it('should return 200 with success true on delete', async () => {
      vi.mocked(deleteCustomerProductMapping).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/customer-product-mappings/cpm-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'cpm-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });
  });
});