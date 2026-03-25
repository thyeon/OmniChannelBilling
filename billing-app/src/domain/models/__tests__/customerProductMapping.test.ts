import { describe, it, expect, vi } from 'vitest';
import {
  CustomerProductMapping,
  CustomerProductMappingInput,
  CustomerProductMappingUpdate,
} from '../customerProductMapping';

describe('CustomerProductMapping', () => {
  // Test 1: Interface accepts all required fields
  it('should accept all required fields', () => {
    const mapping: CustomerProductMapping = {
      id: 'test-id-123',
      customerId: 'customer-456',
      serviceType: 'SMS',
      lineIdentifier: 'DOMESTIC',
      productCode: 'SMS-DOM-001',
      description: 'SMS Domestic Service',
      furtherDescriptionTemplate: 'SMS to {destination}',
      classificationCode: 'CLASS-001',
      unit: 'per_sms',
      taxCode: 'TAX-SMS',
      billingMode: 'ITEMIZED',
      defaultUnitPrice: 0.05,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    };

    expect(mapping.id).toBe('test-id-123');
    expect(mapping.customerId).toBe('customer-456');
    expect(mapping.serviceType).toBe('SMS');
    expect(mapping.lineIdentifier).toBe('DOMESTIC');
    expect(mapping.billingMode).toBe('ITEMIZED');
  });

  // Test 2: Optional accNo field works
  it('should allow optional accNo field', () => {
    const mappingWithAccNo: CustomerProductMapping = {
      id: 'test-id-123',
      customerId: 'customer-456',
      serviceType: 'EMAIL',
      lineIdentifier: 'INTL',
      productCode: 'EMAIL-INT-001',
      description: 'Email International Service',
      furtherDescriptionTemplate: 'Email to {destination}',
      classificationCode: 'CLASS-002',
      unit: 'per_email',
      accNo: 'ACC-001',
      taxCode: 'TAX-EMAIL',
      billingMode: 'LUMP_SUM',
      defaultUnitPrice: 100,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    };

    const mappingWithoutAccNo: CustomerProductMapping = {
      ...mappingWithAccNo,
      accNo: undefined,
    };

    expect(mappingWithAccNo.accNo).toBe('ACC-001');
    expect(mappingWithoutAccNo.accNo).toBeUndefined();
  });

  // Test 3: billingMode accepts ITEMIZED and LUMP_SUM
  it('should accept ITEMIZED and LUMP_SUM billing modes', () => {
    const itemizedMapping: CustomerProductMapping = {
      id: 'test-id-1',
      customerId: 'customer-1',
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
      updatedAt: '2026-01-02T00:00:00Z',
    };

    const lumpSumMapping: CustomerProductMapping = {
      id: 'test-id-2',
      customerId: 'customer-2',
      serviceType: 'WHATSAPP',
      lineIdentifier: 'WHATSAPP',
      productCode: 'WA-001',
      description: 'WhatsApp Service',
      furtherDescriptionTemplate: 'template',
      classificationCode: 'CLS-002',
      unit: 'per_month',
      taxCode: 'TAX-002',
      billingMode: 'LUMP_SUM',
      defaultUnitPrice: 500,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    };

    expect(itemizedMapping.billingMode).toBe('ITEMIZED');
    expect(lumpSumMapping.billingMode).toBe('LUMP_SUM');
  });

  // Test 4: Input type omits id/createdAt/updatedAt
  it('should allow creating input without id, createdAt, updatedAt', () => {
    const input: CustomerProductMappingInput = {
      customerId: 'customer-456',
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

    expect(input.id).toBeUndefined();
    expect(input.createdAt).toBeUndefined();
    expect(input.updatedAt).toBeUndefined();
    expect(input.customerId).toBe('customer-456');
  });

  // Test 5: Update type allows partial updates
  it('should allow partial updates via update type', () => {
    const update: CustomerProductMappingUpdate = {
      productCode: 'SMS-UPDATED-001',
      description: 'Updated SMS Service',
      defaultUnitPrice: 0.10,
    };

    expect(update.productCode).toBe('SMS-UPDATED-001');
    expect(update.description).toBe('Updated SMS Service');
    expect(update.defaultUnitPrice).toBe(0.10);
    expect(update.id).toBeUndefined();
    expect(update.customerId).toBeUndefined();
    expect(update.createdAt).toBeUndefined();
    expect(update.updatedAt).toBeUndefined();
  });
});