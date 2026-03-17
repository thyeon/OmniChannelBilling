/**
 * DataSource Model
 *
 * Defines configurable data sources for multi-customer billing support.
 * Each data source represents a configured endpoint for fetching billable usage data.
 */

export type DataSourceType = 'COWAY_API' | 'RECON_SERVER' | 'CUSTOM_REST_API';
export type AuthType = 'API_KEY' | 'BEARER_TOKEN' | 'BASIC_AUTH' | 'NONE';
export type ServiceType = 'SMS' | 'EMAIL' | 'WHATSAPP';

export interface ResponseMapping {
  // JSON path to usage count (e.g., "data.0.line_items.0.qty")
  usageCountPath: string;
  sentPath?: string;
  failedPath?: string;
}

export interface DataSource {
  id?: string;
  customerId: string;
  type: DataSourceType;
  serviceType: ServiceType;
  name: string;
  apiEndpoint: string;
  authType: AuthType;
  authCredentials?: {
    key?: string;
    token?: string;
    username?: string;
    password?: string;
  };
  responseMapping: ResponseMapping;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Helper type for creating a new DataSource without system-generated fields
 */
export type CreateDataSourceInput = Omit<DataSource, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Helper type for updating an existing DataSource
 */
export type UpdateDataSourceInput = Partial<Omit<DataSource, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>;
