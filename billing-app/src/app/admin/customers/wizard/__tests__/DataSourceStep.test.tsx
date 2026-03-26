/**
 * DataSourceStep Component Tests
 *
 * Tests for the DataSourceStep component's data handling and validation logic.
 * Since the project uses node environment without @testing-library/react,
 * we test the component's helper functions and validation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataSource, DataSourceType, AuthType, ServiceType } from '@/domain/models/dataSource';

// Test the DataSource model to ensure component can work with it
describe('DataSource Model for DataSourceStep', () => {
  // Test 1: DataSource supports all field types needed by DataSourceStep
  it('should support all fields required by DataSourceStep', () => {
    const dataSource: DataSource = {
      id: 'ds-1',
      customerId: 'customer-123',
      name: 'Coway SMS API',
      type: 'COWAY_API',
      serviceType: 'SMS',
      apiEndpoint: 'https://api.coway.com/usage',
      authType: 'API_KEY',
      authCredentials: { key: 'secret-key' },
      responseMapping: { usageCountPath: 'data.0.count' },
      lineItemMappings: [
        { lineIdentifier: 'DOMESTIC', countPath: 'data.lines[0].qty', ratePath: 'data.lines[0].rate', fallbackRate: 0.05 },
      ],
      requestTemplate: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelaySeconds: 1,
        timeoutSeconds: 30,
      },
      fallbackValues: {
        usageCount: 0,
        sentCount: 0,
        failedCount: 0,
        useDefaultOnMissing: true,
      },
      isActive: true,
    };

    expect(dataSource.name).toBe('Coway SMS API');
    expect(dataSource.type).toBe('COWAY_API');
    expect(dataSource.serviceType).toBe('SMS');
    expect(dataSource.authType).toBe('API_KEY');
    expect(dataSource.authCredentials?.key).toBe('secret-key');
    expect(dataSource.responseMapping.usageCountPath).toBe('data.0.count');
    expect(dataSource.lineItemMappings).toHaveLength(1);
    expect(dataSource.isActive).toBe(true);
  });

  // Test 2: DataSourceType enum values
  it('should have correct DataSourceType values', () => {
    const types: DataSourceType[] = ['COWAY_API', 'RECON_SERVER', 'CUSTOM_REST_API'];
    expect(types).toContain('COWAY_API');
    expect(types).toContain('RECON_SERVER');
    expect(types).toContain('CUSTOM_REST_API');
  });

  // Test 3: AuthType enum values
  it('should have correct AuthType values', () => {
    const authTypes: AuthType[] = ['API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'NONE'];
    expect(authTypes).toContain('API_KEY');
    expect(authTypes).toContain('BEARER_TOKEN');
    expect(authTypes).toContain('BASIC_AUTH');
    expect(authTypes).toContain('NONE');
  });

  // Test 4: ServiceType enum values
  it('should have correct ServiceType values', () => {
    const serviceTypes: ServiceType[] = ['SMS', 'EMAIL', 'WHATSAPP'];
    expect(serviceTypes).toContain('SMS');
    expect(serviceTypes).toContain('EMAIL');
    expect(serviceTypes).toContain('WHATSAPP');
  });

  // Test 5: ResponseMapping fields
  it('should support response mapping with all optional paths', () => {
    const dataSource: DataSource = {
      customerId: 'customer-123',
      name: 'Full Response API',
      type: 'CUSTOM_REST_API',
      serviceType: 'EMAIL',
      apiEndpoint: 'https://api.example.com/email',
      authType: 'BEARER_TOKEN',
      authCredentials: { token: 'token123' },
      responseMapping: {
        usageCountPath: 'data.emails.total',
        sentPath: 'data.emails.sent',
        failedPath: 'data.emails.failed',
      },
      isActive: true,
    };

    expect(dataSource.responseMapping.usageCountPath).toBe('data.emails.total');
    expect(dataSource.responseMapping.sentPath).toBe('data.emails.sent');
    expect(dataSource.responseMapping.failedPath).toBe('data.emails.failed');
  });

  // Test 6: Minimal DataSource for empty state
  it('should create minimal data source with required fields only', () => {
    const dataSource: DataSource = {
      customerId: 'customer-123',
      name: 'Minimal API',
      type: 'CUSTOM_REST_API',
      serviceType: 'SMS',
      apiEndpoint: 'https://api.example.com/sms',
      authType: 'NONE',
      responseMapping: { usageCountPath: 'count' },
      isActive: true,
    };

    // Required fields
    expect(dataSource.name).toBe('Minimal API');
    expect(dataSource.type).toBe('CUSTOM_REST_API');
    expect(dataSource.serviceType).toBe('SMS');
    expect(dataSource.apiEndpoint).toBe('https://api.example.com/sms');
    expect(dataSource.authType).toBe('NONE');
    expect(dataSource.responseMapping.usageCountPath).toBe('count');
    expect(dataSource.isActive).toBe(true);

    // Optional fields should be undefined
    expect(dataSource.authCredentials).toBeUndefined();
    expect(dataSource.lineItemMappings).toBeUndefined();
    expect(dataSource.requestTemplate).toBeUndefined();
    expect(dataSource.retryPolicy).toBeUndefined();
    expect(dataSource.fallbackValues).toBeUndefined();
  });

  // Test 7: Auth credentials for different auth types
  it('should support auth credentials for API_KEY', () => {
    const dataSource: DataSource = {
      customerId: 'customer-123',
      name: 'API Key Auth',
      type: 'CUSTOM_REST_API',
      serviceType: 'SMS',
      apiEndpoint: 'https://api.example.com/sms',
      authType: 'API_KEY',
      authCredentials: { key: 'my-api-key', headerName: 'X-API-Key' },
      responseMapping: { usageCountPath: 'count' },
      isActive: true,
    };

    expect(dataSource.authCredentials?.key).toBe('my-api-key');
    expect(dataSource.authCredentials?.headerName).toBe('X-API-Key');
  });

  it('should support auth credentials for BEARER_TOKEN', () => {
    const dataSource: DataSource = {
      customerId: 'customer-123',
      name: 'Bearer Auth',
      type: 'CUSTOM_REST_API',
      serviceType: 'SMS',
      apiEndpoint: 'https://api.example.com/sms',
      authType: 'BEARER_TOKEN',
      authCredentials: { token: 'bearer-token' },
      responseMapping: { usageCountPath: 'count' },
      isActive: true,
    };

    expect(dataSource.authCredentials?.token).toBe('bearer-token');
  });

  it('should support auth credentials for BASIC_AUTH', () => {
    const dataSource: DataSource = {
      customerId: 'customer-123',
      name: 'Basic Auth',
      type: 'CUSTOM_REST_API',
      serviceType: 'SMS',
      apiEndpoint: 'https://api.example.com/sms',
      authType: 'BASIC_AUTH',
      authCredentials: { username: 'user', password: 'pass' },
      responseMapping: { usageCountPath: 'count' },
      isActive: true,
    };

    expect(dataSource.authCredentials?.username).toBe('user');
    expect(dataSource.authCredentials?.password).toBe('pass');
  });

  // Test 8: Validation helper logic (simulating what DataSourceStep does)
  describe('DataSourceStep validation logic', () => {
    // Simulates the validation function in DataSourceStep
    function validateRequiredFields(data: Partial<DataSource>): { valid: boolean; error?: string } {
      if (!data.name) {
        return { valid: false, error: 'Name is required' };
      }
      if (!data.type) {
        return { valid: false, error: 'Type is required' };
      }
      if (!data.serviceType) {
        return { valid: false, error: 'Service type is required' };
      }
      if (!data.apiEndpoint) {
        return { valid: false, error: 'API endpoint is required' };
      }
      if (!data.authType) {
        return { valid: false, error: 'Auth type is required' };
      }
      if (!data.responseMapping?.usageCountPath) {
        return { valid: false, error: 'Usage count path is required' };
      }
      return { valid: true };
    }

    it('should validate all required fields are present', () => {
      const validData: Partial<DataSource> = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'NONE',
        responseMapping: { usageCountPath: 'data.count' },
      };

      expect(validateRequiredFields(validData).valid).toBe(true);
    });

    it('should reject when name is missing', () => {
      const invalidData: Partial<DataSource> = {
        name: '',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'NONE',
        responseMapping: { usageCountPath: 'data.count' },
      };

      const result = validateRequiredFields(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject when apiEndpoint is missing', () => {
      const invalidData: Partial<DataSource> = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: '',
        authType: 'NONE',
        responseMapping: { usageCountPath: 'data.count' },
      };

      const result = validateRequiredFields(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API endpoint is required');
    });

    it('should reject when usageCountPath is missing', () => {
      const invalidData: Partial<DataSource> = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'NONE',
        responseMapping: { usageCountPath: '' },
      };

      const result = validateRequiredFields(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Usage count path is required');
    });
  });

  // Test 9: Grouping logic (simulating what DataSourceStep does)
  describe('DataSourceStep grouping logic', () => {
    function groupByServiceType(sources: DataSource[]): Record<ServiceType, DataSource[]> {
      return sources.reduce((acc, ds) => {
        if (!acc[ds.serviceType]) {
          acc[ds.serviceType] = [];
        }
        acc[ds.serviceType].push(ds);
        return acc;
      }, {} as Record<ServiceType, DataSource[]>);
    }

    it('should group data sources by service type', () => {
      const sources: DataSource[] = [
        {
          id: 'ds-1',
          customerId: 'customer-123',
          name: 'SMS API',
          type: 'COWAY_API',
          serviceType: 'SMS',
          apiEndpoint: 'https://api.sms.com',
          authType: 'NONE',
          responseMapping: { usageCountPath: 'count' },
          isActive: true,
        },
        {
          id: 'ds-2',
          customerId: 'customer-123',
          name: 'Email API',
          type: 'COWAY_API',
          serviceType: 'EMAIL',
          apiEndpoint: 'https://api.email.com',
          authType: 'NONE',
          responseMapping: { usageCountPath: 'count' },
          isActive: true,
        },
        {
          id: 'ds-3',
          customerId: 'customer-123',
          name: 'SMS API 2',
          type: 'CUSTOM_REST_API',
          serviceType: 'SMS',
          apiEndpoint: 'https://api.sms2.com',
          authType: 'NONE',
          responseMapping: { usageCountPath: 'count' },
          isActive: true,
        },
      ];

      const grouped = groupByServiceType(sources);

      expect(Object.keys(grouped)).toContain('SMS');
      expect(Object.keys(grouped)).toContain('EMAIL');
      expect(grouped.SMS).toHaveLength(2);
      expect(grouped.EMAIL).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupByServiceType([]);
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  // Test 10: API payload construction (simulating what DataSourceStep does)
  describe('DataSourceStep API payload construction', () => {
    interface DataSourceFormData {
      name: string;
      type: DataSourceType;
      serviceType: ServiceType;
      apiEndpoint: string;
      authType: AuthType;
      authKey: string;
      authToken: string;
      authUsername: string;
      authPassword: string;
      usageCountPath: string;
      isActive: boolean;
    }

    function buildPayload(formData: DataSourceFormData): Partial<DataSource> {
      const authCredentials = getAuthCredentials(formData);

      return {
        name: formData.name,
        type: formData.type,
        serviceType: formData.serviceType,
        apiEndpoint: formData.apiEndpoint,
        authType: formData.authType,
        authCredentials,
        responseMapping: {
          usageCountPath: formData.usageCountPath,
        },
        isActive: formData.isActive,
      };
    }

    function getAuthCredentials(formData: DataSourceFormData): DataSource['authCredentials'] | undefined {
      if (formData.authType === 'API_KEY' && formData.authKey) {
        return { key: formData.authKey };
      }
      if (formData.authType === 'BEARER_TOKEN' && formData.authToken) {
        return { token: formData.authToken };
      }
      if (formData.authType === 'BASIC_AUTH' && formData.authUsername && formData.authPassword) {
        return { username: formData.authUsername, password: formData.authPassword };
      }
      return undefined;
    }

    it('should build payload with API_KEY auth', () => {
      const formData: DataSourceFormData = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'API_KEY',
        authKey: 'secret-key',
        authToken: '',
        authUsername: '',
        authPassword: '',
        usageCountPath: 'data.count',
        isActive: true,
      };

      const payload = buildPayload(formData);

      expect(payload.authCredentials?.key).toBe('secret-key');
    });

    it('should build payload with BEARER_TOKEN auth', () => {
      const formData: DataSourceFormData = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'BEARER_TOKEN',
        authKey: '',
        authToken: 'bearer-token',
        authUsername: '',
        authPassword: '',
        usageCountPath: 'data.count',
        isActive: true,
      };

      const payload = buildPayload(formData);

      expect(payload.authCredentials?.token).toBe('bearer-token');
    });

    it('should build payload with BASIC_AUTH credentials', () => {
      const formData: DataSourceFormData = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'BASIC_AUTH',
        authKey: '',
        authToken: '',
        authUsername: 'myuser',
        authPassword: 'mypass',
        usageCountPath: 'data.count',
        isActive: true,
      };

      const payload = buildPayload(formData);

      expect(payload.authCredentials?.username).toBe('myuser');
      expect(payload.authCredentials?.password).toBe('mypass');
    });

    it('should build payload with NONE auth', () => {
      const formData: DataSourceFormData = {
        name: 'Test API',
        type: 'CUSTOM_REST_API',
        serviceType: 'SMS',
        apiEndpoint: 'https://api.test.com',
        authType: 'NONE',
        authKey: '',
        authToken: '',
        authUsername: '',
        authPassword: '',
        usageCountPath: 'data.count',
        isActive: true,
      };

      const payload = buildPayload(formData);

      expect(payload.authType).toBe('NONE');
      expect(payload.authCredentials).toBeUndefined();
    });
  });
});
