Objective:  1. Create Type Definitions, refer to the following for a start, improve and enhance if there is a need. 

export type ServiceType = 'SMS' | 'EMAIL' | 'WHATSAPP';
export type InvoiceStatus = 'DRAFT' | 'GENERATED' | 'SYNCED' | 'ERROR';

export interface ServiceProvider {
  id: string;
  name: string;
  type: ServiceType;
  apiKey: string;
  apiEndpoint: string;
}

export interface Customer {
  id: string;
  name: string;
  // Mapping to AutoCount Cloud System
  autocountCustomerId: string; 
  services: ServiceType[];
  providers: ServiceProvider[];
  rates: { [key in ServiceType]: number; };
  billingMode: 'MANUAL' | 'AUTO_PILOT';
  billingSchedule?: number; // 1-31
  consolidateInvoice: boolean;
  // Configurable threshold for discrepancy logic (e.g., 1.0 = 1%)
  discrepancyThreshold: number; 
}

export interface InvoiceHistory {
  id: string;
  customerId: string;
  customerName: string;
  billingMonth: string; // "2023-10"
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface UsageData {
  service: ServiceType;
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
}


## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
