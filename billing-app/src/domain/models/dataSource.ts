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
  // INGLAB nested response config for parsing nested line items
  nestedResponseConfig?: NestedResponseConfig;
}

/**
 * Line item mapping for parsing multi-line API responses
 */
export interface LineItemMapping {
  lineIdentifier: string;
  countPath: string;
  ratePath?: string;
  fallbackRate?: number;
}

/**
 * Result of processing multi-line data from API response
 */
export interface MultiLineResult {
  lineIdentifier: string;
  count: number;
  rate?: number;
  fallbackRate?: number;
}

/**
 * Result of processing legacy single-line data from API response
 */
export interface SingleLineResult {
  usageCount: number;
  sentCount?: number;
  failedCount?: number;
}

/**
 * Request template for API calls
 */
export interface RequestTemplate {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxRetries: number;
  retryDelaySeconds: number;
  timeoutSeconds: number;
}

/**
 * Fallback values when API response is missing fields
 */
export interface FallbackValues {
  usageCount?: number;
  sentCount?: number;
  failedCount?: number;
  useDefaultOnMissing: boolean;
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
    headerName?: string;
    // For COWAY_API: body fields "user", "secret", and "serviceProvider"
    user?: string;
    secret?: string;
    serviceProvider?: string;
  };
  responseMapping?: ResponseMapping;
  lineItemMappings?: LineItemMapping[];
  requestTemplate?: RequestTemplate;
  retryPolicy?: RetryPolicy;
  fallbackValues?: FallbackValues;
  // INGLAB: client_id for ?client_id= query param on INGLAB API
  sourceClientId?: string;
  // INGLAB: nested response config for parsing nested line items (e.g. items[].line_items[])
  nestedResponseConfig?: NestedResponseConfig;
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

/**
 * Configuration for parsing nested INGLAB-style API responses.
 * Used by processInglabNested to extract per-row data from items[].line_items[].
 */
export interface NestedResponseConfig {
  itemsPath: string;
  lineItemsPath: string;
  descriptionPath: string;
  descriptionDetailPath?: string;
  qtyPath: string;
  unitPricePath: string;
  servicePath?: string;
}
