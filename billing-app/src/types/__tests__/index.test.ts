import { Customer } from '../index';

describe('Customer type', () => {
  it('should include status field with valid values', () => {
    const customer: Customer = {
      id: 'test-1',
      name: 'Test Customer',
      autocountCustomerId: 'AC-001',
      services: ['SMS'],
      providers: [],
      reconServers: [],
      rates: { SMS: 0.1, EMAIL: 0.05, WHATSAPP: 0.08 },
      billingMode: 'MANUAL',
      consolidateInvoice: false,
      discrepancyThreshold: 1.0,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
    };

    expect(customer.status).toBe('ACTIVE');
  });

  it('should include billingCycle field with valid values', () => {
    const customer: Customer = {
      id: 'test-2',
      name: 'Test Customer 2',
      autocountCustomerId: 'AC-002',
      services: ['EMAIL'],
      providers: [],
      reconServers: [],
      rates: { SMS: 0.1, EMAIL: 0.05, WHATSAPP: 0.08 },
      billingMode: 'AUTO_PILOT',
      consolidateInvoice: true,
      discrepancyThreshold: 0.5,
      status: 'SUSPENDED',
      billingCycle: 'QUARTERLY',
    };

    expect(customer.billingCycle).toBe('QUARTERLY');
  });

  it('should include optional defaultFields', () => {
    const customer: Customer = {
      id: 'test-3',
      name: 'Test Customer 3',
      autocountCustomerId: 'AC-003',
      services: ['WHATSAPP'],
      providers: [],
      reconServers: [],
      rates: { SMS: 0.1, EMAIL: 0.05, WHATSAPP: 0.08 },
      billingMode: 'MANUAL',
      consolidateInvoice: false,
      discrepancyThreshold: 1.0,
      status: 'MAINTENANCE',
      billingCycle: 'YEARLY',
      defaultFields: {
        creditTerm: '30',
        salesLocation: 'HQ',
        taxCode: 'TX001',
        description: 'Annual customer',
      },
    };

    expect(customer.defaultFields?.creditTerm).toBe('30');
    expect(customer.defaultFields?.salesLocation).toBe('HQ');
    expect(customer.defaultFields?.taxCode).toBe('TX001');
    expect(customer.defaultFields?.description).toBe('Annual customer');
  });

  it('should allow defaultFields to be optional', () => {
    const customer: Customer = {
      id: 'test-4',
      name: 'Test Customer 4',
      autocountCustomerId: 'AC-004',
      services: ['SMS'],
      providers: [],
      reconServers: [],
      rates: { SMS: 0.1, EMAIL: 0.05, WHATSAPP: 0.08 },
      billingMode: 'MANUAL',
      consolidateInvoice: false,
      discrepancyThreshold: 1.0,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
    };

    expect(customer.defaultFields).toBeUndefined();
  });
});