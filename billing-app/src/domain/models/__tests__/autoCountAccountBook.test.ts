import { describe, it, expect } from 'vitest';
import { AutoCountAccountBook, AutoCountAccountBookInput, AutoCountAccountBookUpdate } from '../autoCountAccountBook';

describe('AutoCountAccountBook Model', () => {
  describe('AutoCountAccountBook interface', () => {
    it('should have all 5 new optional fields', () => {
      const accountBook: AutoCountAccountBook = {
        id: '1',
        name: 'Test Account Book',
        accountBookId: 'AB123',
        keyId: 'KEY123',
        apiKey: 'api-key-123',
        defaultCreditTerm: '30',
        defaultSalesLocation: 'KL',
        defaultSalesAgent: 'Olivia Yap',
        defaultAccNo: '500-0000',
        defaultClassificationCode: '022',
        inclusiveTax: false,
        submitEInvoice: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(accountBook.defaultSalesAgent).toBe('Olivia Yap');
      expect(accountBook.defaultAccNo).toBe('500-0000');
      expect(accountBook.defaultClassificationCode).toBe('022');
      expect(accountBook.inclusiveTax).toBe(false);
      expect(accountBook.submitEInvoice).toBe(false);
    });

    it('should allow omitting new fields for backward compatibility', () => {
      const accountBook: AutoCountAccountBook = {
        id: '2',
        name: 'Minimal Account Book',
        accountBookId: 'AB456',
        keyId: 'KEY456',
        apiKey: 'api-key-456',
        defaultCreditTerm: '30',
        defaultSalesLocation: 'KL',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(accountBook.defaultSalesAgent).toBeUndefined();
      expect(accountBook.defaultAccNo).toBeUndefined();
      expect(accountBook.defaultClassificationCode).toBeUndefined();
      expect(accountBook.inclusiveTax).toBeUndefined();
      expect(accountBook.submitEInvoice).toBeUndefined();
    });

    it('should allow setting new fields to undefined explicitly', () => {
      const accountBook: AutoCountAccountBook = {
        id: '3',
        name: 'Explicit Undefined',
        accountBookId: 'AB789',
        keyId: 'KEY789',
        apiKey: 'api-key-789',
        defaultCreditTerm: '30',
        defaultSalesLocation: 'KL',
        defaultSalesAgent: undefined,
        defaultAccNo: undefined,
        defaultClassificationCode: undefined,
        inclusiveTax: undefined,
        submitEInvoice: undefined,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(accountBook.defaultSalesAgent).toBeUndefined();
      expect(accountBook.defaultAccNo).toBeUndefined();
      expect(accountBook.defaultClassificationCode).toBeUndefined();
      expect(accountBook.inclusiveTax).toBeUndefined();
      expect(accountBook.submitEInvoice).toBeUndefined();
    });
  });

  describe('AutoCountAccountBookInput interface', () => {
    it('should include all 5 new optional fields', () => {
      const input: AutoCountAccountBookInput = {
        name: 'Input Account Book',
        accountBookId: 'AB123',
        keyId: 'KEY123',
        apiKey: 'api-key-123',
        defaultCreditTerm: '30',
        defaultSalesLocation: 'KL',
        defaultSalesAgent: 'Olivia Yap',
        defaultAccNo: '500-0000',
        defaultClassificationCode: '022',
        inclusiveTax: true,
        submitEInvoice: true,
      };

      expect(input.defaultSalesAgent).toBe('Olivia Yap');
      expect(input.defaultAccNo).toBe('500-0000');
      expect(input.defaultClassificationCode).toBe('022');
      expect(input.inclusiveTax).toBe(true);
      expect(input.submitEInvoice).toBe(true);
    });
  });

  describe('AutoCountAccountBookUpdate interface', () => {
    it('should include all 5 new optional fields', () => {
      const update: AutoCountAccountBookUpdate = {
        name: 'Updated Name',
        defaultSalesAgent: 'New Agent',
        defaultAccNo: '600-0000',
        defaultClassificationCode: '033',
        inclusiveTax: false,
        submitEInvoice: true,
      };

      expect(update.name).toBe('Updated Name');
      expect(update.defaultSalesAgent).toBe('New Agent');
      expect(update.defaultAccNo).toBe('600-0000');
      expect(update.defaultClassificationCode).toBe('033');
      expect(update.inclusiveTax).toBe(false);
      expect(update.submitEInvoice).toBe(true);
    });
  });
});