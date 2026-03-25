/**
 * DataSource Model Tests
 *
 * Tests for the DataSource model and its interfaces.
 */

import { describe, it, expect } from 'vitest';
import {
  DataSource,
  DataSourceType,
  AuthType,
  ServiceType,
  ResponseMapping,
  LineItemMapping,
  RequestTemplate,
  RetryPolicy,
  FallbackValues,
  CreateDataSourceInput,
  UpdateDataSourceInput,
} from '../dataSource';

describe('DataSource Model', () => {
  describe('LineItemMapping', () => {
    it('should allow creating a line item mapping with required fields', () => {
      const mapping: LineItemMapping = {
        lineIdentifier: 'SMS-DOMESTIC',
        countPath: 'data[0].line_items[0].qty',
      };

      expect(mapping.lineIdentifier).toBe('SMS-DOMESTIC');
      expect(mapping.countPath).toBe('data[0].line_items[0].qty');
      expect(mapping.ratePath).toBeUndefined();
      expect(mapping.fallbackRate).toBeUndefined();
    });

    it('should allow creating a line item mapping with optional fields', () => {
      const mapping: LineItemMapping = {
        lineIdentifier: 'SMS-INTL',
        countPath: 'data[0].line_items[1].qty',
        ratePath: 'data[0].line_items[1].rate',
        fallbackRate: 0.05,
      };

      expect(mapping.ratePath).toBe('data[0].line_items[1].rate');
      expect(mapping.fallbackRate).toBe(0.05);
    });
  });

  describe('RequestTemplate', () => {
    it('should allow creating a GET request template', () => {
      const template: RequestTemplate = {
        method: 'GET',
      };

      expect(template.method).toBe('GET');
      expect(template.headers).toBeUndefined();
      expect(template.bodyTemplate).toBeUndefined();
    });

    it('should allow creating a POST request template with all fields', () => {
      const template: RequestTemplate = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
        bodyTemplate: '{"billingMonth": "{billingMonth}", "year": "{year}"}',
      };

      expect(template.method).toBe('POST');
      expect(template.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      });
      expect(template.bodyTemplate).toContain('{billingMonth}');
    });
  });

  describe('RetryPolicy', () => {
    it('should allow creating a retry policy', () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        retryDelaySeconds: 5,
        timeoutSeconds: 30,
      };

      expect(policy.maxRetries).toBe(3);
      expect(policy.retryDelaySeconds).toBe(5);
      expect(policy.timeoutSeconds).toBe(30);
    });
  });

  describe('FallbackValues', () => {
    it('should allow creating fallback values', () => {
      const fallback: FallbackValues = {
        usageCount: 0,
        sentCount: 0,
        failedCount: 0,
        useDefaultOnMissing: true,
      };

      expect(fallback.usageCount).toBe(0);
      expect(fallback.sentCount).toBe(0);
      expect(fallback.failedCount).toBe(0);
      expect(fallback.useDefaultOnMissing).toBe(true);
    });

    it('should allow partial fallback values', () => {
      const fallback: FallbackValues = {
        useDefaultOnMissing: false,
      };

      expect(fallback.usageCount).toBeUndefined();
      expect(fallback.useDefaultOnMissing).toBe(false);
    });
  });

  describe('DataSource', () => {
    it('should create a minimal data source', () => {
      const dataSource: DataSource = {
        customerId: 'customer-123',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        name: 'Test API',
        apiEndpoint: 'https://api.example.com/v1/usage',
        authType: 'API_KEY',
        responseMapping: {
          usageCountPath: 'data.count',
        },
        isActive: true,
      };

      expect(dataSource.customerId).toBe('customer-123');
      expect(dataSource.type).toBe('CUSTOM_REST_API');
      expect(dataSource.isActive).toBe(true);
    });

    it('should create a data source with all optional fields', () => {
      const dataSource: DataSource = {
        id: 'ds-001',
        customerId: 'customer-123',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        name: 'Full Config API',
        apiEndpoint: 'https://api.example.com/v1/usage',
        authType: 'API_KEY',
        authCredentials: {
          key: 'api-key-123',
          headerName: 'x-token',
        },
        responseMapping: {
          usageCountPath: 'data.count',
          sentPath: 'data.sent',
          failedPath: 'data.failed',
        },
        lineItemMappings: [
          {
            lineIdentifier: 'SMS-DOMESTIC',
            countPath: 'data.lines[0].qty',
            ratePath: 'data.lines[0].rate',
            fallbackRate: 0.03,
          },
          {
            lineIdentifier: 'SMS-INTL',
            countPath: 'data.lines[1].qty',
            fallbackRate: 0.05,
          },
        ],
        requestTemplate: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          bodyTemplate: '{"month": "{month}", "year": "{year}"}',
        },
        retryPolicy: {
          maxRetries: 3,
          retryDelaySeconds: 5,
          timeoutSeconds: 30,
        },
        fallbackValues: {
          usageCount: 0,
          sentCount: 0,
          failedCount: 0,
          useDefaultOnMissing: true,
        },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      expect(dataSource.id).toBe('ds-001');
      expect(dataSource.authCredentials?.headerName).toBe('x-token');
      expect(dataSource.lineItemMappings).toHaveLength(2);
      expect(dataSource.lineItemMappings?.[0].lineIdentifier).toBe('SMS-DOMESTIC');
      expect(dataSource.requestTemplate?.method).toBe('POST');
      expect(dataSource.retryPolicy?.maxRetries).toBe(3);
      expect(dataSource.fallbackValues?.useDefaultOnMissing).toBe(true);
    });

    it('should allow lineItemMappings to take precedence over responseMapping', () => {
      // This test verifies the model allows the data structure
      // The precedence logic would be implemented in the service layer
      const dataSource: DataSource = {
        customerId: 'customer-123',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        name: 'Multi-line API',
        apiEndpoint: 'https://api.example.com/v1/usage',
        authType: 'NONE',
        responseMapping: {
          usageCountPath: 'data.total', // This should be ignored when lineItemMappings present
        },
        lineItemMappings: [
          {
            lineIdentifier: 'SMS-DOMESTIC',
            countPath: 'data.lines[0].qty',
          },
        ],
        isActive: true,
      };

      expect(dataSource.lineItemMappings).toBeDefined();
      expect(dataSource.responseMapping).toBeDefined();
    });

    it('should allow headerName in authCredentials for non-standard headers', () => {
      const dataSource: DataSource = {
        customerId: 'customer-123',
        type: 'CUSTOM_REST_API',
        serviceType: 'WHATSAPP',
        name: 'WhatsApp API',
        apiEndpoint: 'https://whatsapp.api.com/v1/messages',
        authType: 'API_KEY',
        authCredentials: {
          key: 'wa-token-123',
          headerName: 'x-whatsapp-token', // Non-standard header
        },
        responseMapping: {
          usageCountPath: 'data.messages.count',
        },
        isActive: true,
      };

      expect(dataSource.authCredentials?.headerName).toBe('x-whatsapp-token');
    });
  });

  describe('CreateDataSourceInput', () => {
    it('should create a valid input without system fields', () => {
      const input: CreateDataSourceInput = {
        customerId: 'customer-123',
        type: 'CUSTOM_REST_API',
        serviceType: 'EMAIL',
        name: 'Email Provider',
        apiEndpoint: 'https://email.api.com/v1/usage',
        authType: 'BEARER_TOKEN',
        authCredentials: {
          token: 'bearer-token',
        },
        responseMapping: {
          usageCountPath: 'data.emails.sent',
        },
        isActive: true,
      };

      expect(input.id).toBeUndefined();
      expect(input.createdAt).toBeUndefined();
      expect(input.updatedAt).toBeUndefined();
    });
  });

  describe('UpdateDataSourceInput', () => {
    it('should allow updating optional fields only', () => {
      const input: UpdateDataSourceInput = {
        name: 'Updated Name',
        isActive: false,
        requestTemplate: {
          method: 'POST',
        },
      };

      expect(input.customerId).toBeUndefined();
      expect(input.id).toBeUndefined();
      expect(input.name).toBe('Updated Name');
    });
  });

  describe('Type exports', () => {
    it('should have all required type exports', () => {
      // Verify all types are exported and can be referenced
      const dataSourceTypes: DataSourceType[] = ['COWAY_API', 'RECON_SERVER', 'CUSTOM_REST_API'];
      const authTypes: AuthType[] = ['API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'NONE'];
      const serviceTypes: ServiceType[] = ['SMS', 'EMAIL', 'WHATSAPP'];

      expect(dataSourceTypes).toHaveLength(3);
      expect(authTypes).toHaveLength(4);
      expect(serviceTypes).toHaveLength(3);
    });
  });
});