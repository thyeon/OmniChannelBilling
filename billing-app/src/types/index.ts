export type ServiceType = 'SMS' | 'EMAIL' | 'WHATSAPP';
export type InvoiceStatus = 'DRAFT' | 'GENERATED' | 'SYNCED' | 'ERROR';

export interface ServiceProvider {
  id: string;
  name: string;
  type: ServiceType;
  apiKey: string;
  apiEndpoint: string;
}

export interface ReconServer {
  id: string;
  name: string;
  type: ServiceType;
  userId: string;
  apiKey: string;
  apiEndpoint: string;
  apiFormat?: 'SMS_RECON' | 'EMAIL_RECON';
}

export interface BillingSchedule {
  dayOfMonth: number;           // 1-31
  time: string;                 // "09:00" (24h format)
  retryIntervalMinutes: number; // e.g. 30
  maxRetries: number;           // e.g. 3
}

export interface Customer {
  id: string;
  name: string;
  // Mapping to AutoCount Cloud System
  autocountCustomerId: string;
  services: ServiceType[];
  providers: ServiceProvider[];
  reconServers: ReconServer[];
  rates: { [key in ServiceType]: number };
  billingMode: 'MANUAL' | 'AUTO_PILOT';
  schedule?: BillingSchedule;
  consolidateInvoice: boolean;
  // Configurable threshold for discrepancy logic (e.g., 1.0 = 1%)
  discrepancyThreshold: number;
  // AutoCount Integration (Option C)
  autocountAccountBookId?: string;
  autocountDebtorCode?: string;
  creditTermOverride?: string;
  salesLocationOverride?: string;
  serviceProductOverrides?: Array<{
    serviceType: ServiceType;
    productCode: string;
    billingMode?: 'ITEMIZED' | 'LUMP_SUM';
  }>;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
  furtherDescriptionSMSIntl?: string;
  // Data Sources - for configurable billing (multi-customer support)
  dataSources?: Array<{
    id?: string;
    type: 'COWAY_API' | 'RECON_SERVER' | 'CUSTOM_REST_API';
    serviceType: ServiceType;
    name: string;
    apiEndpoint: string;
    authType: 'API_KEY' | 'BEARER_TOKEN' | 'BASIC_AUTH' | 'NONE';
    authCredentials?: {
      key?: string;
      token?: string;
      username?: string;
      password?: string;
    };
    responseMapping: {
      usageCountPath: string;
      sentPath?: string;
      failedPath?: string;
    };
    isActive: boolean;
  }>;
}

export type ConnectionStatus = 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED';

export interface InvoiceLineItem {
  service: ServiceType;
  hasProvider: boolean;
  // Connection status (captured at generation time)
  reconServerStatus: ConnectionStatus;
  providerStatus: ConnectionStatus;
  reconServerName: string;
  providerName: string;
  // Usage data snapshot
  reconTotal: number;
  reconDetails: { sent: number; failed: number; withheld: number };
  providerTotal: number;
  // Discrepancy
  discrepancyPercentage: number;
  isMismatch: boolean;
  thresholdUsed: number;
  // Billing decision
  billableCount: number;
  wasOverridden: boolean;
  overrideReason?: string;
  // Charge
  rate: number;
  totalCharge: number;
}

export interface InvoiceHistory {
  id: string;
  customerId: string;
  customerName: string;
  billingMonth: string; // "2023-10"
  totalAmount: number;
  status: InvoiceStatus;
  // Present only when status is SYNCED
  autocountRefId?: string;
  createdAt: string;
  // Enhanced fields
  billingMode: 'MANUAL' | 'AUTO_PILOT';
  schedule?: BillingSchedule;
  lineItems: InvoiceLineItem[];
  generatedBy: 'MANUAL' | 'SCHEDULED';
  scheduledJobId?: string;
  syncError?: string;
  // Custom payload for AutoCount (user-edited)
  customPayload?: string;
}

export type ScheduleJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface ScheduledJob {
  id: string;
  customerId: string;
  customerName: string;
  billingMonth: string;           // "2023-12" (previous month being billed)
  scheduledAt: string;            // ISO datetime
  status: ScheduleJobStatus;
  retryCount: number;
  maxRetries: number;
  retryIntervalMinutes: number;
  nextRetryAt?: string;
  invoiceId?: string;             // links to InvoiceHistory once generated
  error?: string;
  completedAt?: string;
}

export interface UsageData {
  service: ServiceType;
  hasProvider: boolean;
  reconServerStatus: ConnectionStatus;
  providerStatus: ConnectionStatus;
  reconServerName: string;
  providerName: string;
  reconTotal: number;
  providerTotal: number;
  reconDetails: {
    sent: number;
    failed: number;
    withheld: number;
  };
  billableCount: number;
  rate: number;
  totalCharge: number;
  isMismatch: boolean;
  discrepancyPercentage: number;
  thresholdUsed: number;
}
