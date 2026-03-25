/**
 * Configuration Service
 *
 * Central service for loading and caching customer configurations.
 * Handles customer data and data sources with credential masking.
 */

import { configCache } from './configCache';
import { maskCredential } from './credentialEncryptionService';
import { findCustomerById } from '@/infrastructure/db/customerRepository';
import { findActiveDataSourcesByCustomerId } from '@/infrastructure/db/dataSourceRepository';
import { Customer } from '@/types';
import { DataSource } from '@/domain/models/dataSource';

export interface MaskedDataSource extends Omit<DataSource, 'authCredentials'> {
  maskedCredentials?: Record<string, string>;
}

export interface CustomerConfig {
  customer: Customer;
  dataSources: MaskedDataSource[];
  loadedAt: string;
}

// Load customer config with cache
export async function loadCustomerConfig(customerId: string): Promise<CustomerConfig | null> {
  const cacheKey = `customer:${customerId}`;
  const cached = configCache.get<CustomerConfig>(cacheKey);
  if (cached) return cached;

  const customer = await findCustomerById(customerId);
  if (!customer) return null;

  const dataSources = await findActiveDataSourcesByCustomerId(customerId);
  const maskedDataSources: MaskedDataSource[] = dataSources.map(ds => {
    if (ds.authCredentials) {
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(ds.authCredentials)) {
        if (value && typeof value === 'string') {
          masked[key] = maskCredential(value);
        }
      }
      return { ...ds, maskedCredentials: masked };
    }
    return ds;
  });

  const config: CustomerConfig = {
    customer,
    dataSources: maskedDataSources,
    loadedAt: new Date().toISOString(),
  };
  configCache.set(cacheKey, config, 5);
  return config;
}

export async function invalidateCustomerCache(customerId: string): Promise<void> {
  configCache.invalidate(customerId);
}