export interface BillingClient {
  id?: string;
  source_client_name: string;
  debtor_code: string;
  tax_entity: string;
  address: string;
  tax_code?: string;  // Optional - defaults to "SV-8" if not specified
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}
