/**
 * Billing Cycle Tests
 *
 * Tests for shouldBillThisMonth function covering MONTHLY, QUARTERLY, and YEARLY cycles.
 */

import { Customer } from '@/types';
import { shouldBillThisMonth } from '../billingService';

describe('shouldBillThisMonth', () => {
  const createCustomer = (overrides: Partial<Customer> = {}): Customer => ({
    id: 'test-customer',
    name: 'Test Customer',
    autocountCustomerId: 'AC001',
    services: ['SMS', 'WHATSAPP', 'EMAIL'],
    providers: [],
    reconServers: [],
    rates: { SMS: 0.10, WHATSAPP: 0.15, EMAIL: 0.05 },
    billingMode: 'AUTO_PILOT',
    consolidateInvoice: true,
    discrepancyThreshold: 1.0,
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    ...overrides,
  });

  describe('MONTHLY billing cycle', () => {
    it('should return true for all months', () => {
      const customer = createCustomer({ billingCycle: 'MONTHLY' });

      // Test all 12 months
      for (let month = 1; month <= 12; month++) {
        const billingMonth = `2026-${month.toString().padStart(2, '0')}`;
        expect(shouldBillThisMonth(customer, billingMonth)).toBe(true);
      }
    });
  });

  describe('QUARTERLY billing cycle', () => {
    it('should return true for months 1, 4, 7, 10 (Jan, Apr, Jul, Oct)', () => {
      const customer = createCustomer({ billingCycle: 'QUARTERLY' });

      expect(shouldBillThisMonth(customer, '2026-01')).toBe(true);
      expect(shouldBillThisMonth(customer, '2026-04')).toBe(true);
      expect(shouldBillThisMonth(customer, '2026-07')).toBe(true);
      expect(shouldBillThisMonth(customer, '2026-10')).toBe(true);
    });

    it('should return false for months 2, 3, 5, 6, 8, 9, 11, 12', () => {
      const customer = createCustomer({ billingCycle: 'QUARTERLY' });

      expect(shouldBillThisMonth(customer, '2026-02')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-03')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-05')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-06')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-08')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-09')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-11')).toBe(false);
      expect(shouldBillThisMonth(customer, '2026-12')).toBe(false);
    });
  });

  describe('YEARLY billing cycle', () => {
    it('should return true only on the configured billing start month', () => {
      const customer = createCustomer({
        billingCycle: 'YEARLY',
        billingStartMonth: 3, // March
      });

      expect(shouldBillThisMonth(customer, '2026-03')).toBe(true);
      expect(shouldBillThisMonth(customer, '2027-03')).toBe(true);
    });

    it('should return false for all months except the configured start month', () => {
      const customer = createCustomer({
        billingCycle: 'YEARLY',
        billingStartMonth: 3, // March
      });

      for (let month = 1; month <= 12; month++) {
        if (month !== 3) {
          const billingMonth = `2026-${month.toString().padStart(2, '0')}`;
          expect(shouldBillThisMonth(customer, billingMonth)).toBe(false);
        }
      }
    });

    it('should default to January if billingStartMonth is not set', () => {
      const customer = createCustomer({
        billingCycle: 'YEARLY',
        billingStartMonth: undefined,
      });

      expect(shouldBillThisMonth(customer, '2026-01')).toBe(true);
      expect(shouldBillThisMonth(customer, '2026-02')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing billingCycle (default to MONTHLY)', () => {
      const customer = createCustomer();
      delete (customer as any).billingCycle;

      expect(shouldBillThisMonth(customer, '2026-06')).toBe(true);
    });

    it('should handle invalid month format gracefully', () => {
      const customer = createCustomer({ billingCycle: 'MONTHLY' });

      // Invalid format returns true for MONTHLY
      expect(shouldBillThisMonth(customer, 'invalid')).toBe(true);
    });
  });
});