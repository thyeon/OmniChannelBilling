/**
 * Service Product Mapping
 *
 * Maps a service type (SMS, EMAIL, WHATSAPP) to an AutoCount product code
 * within a specific account book. Customers can override these mappings.
 */

export interface ServiceProductMapping {
  id: string;
  accountBookId: string;
  serviceType: "SMS" | "EMAIL" | "WHATSAPP";
  productCode: string;
  description?: string;
  defaultUnitPrice?: number;
  defaultBillingMode?: "ITEMIZED" | "LUMP_SUM";
  taxCode?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProductMappingInput {
  accountBookId: string;
  serviceType: "SMS" | "EMAIL" | "WHATSAPP";
  productCode: string;
  description?: string;
  defaultUnitPrice?: number;
  defaultBillingMode?: "ITEMIZED" | "LUMP_SUM";
  taxCode?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}

export interface ServiceProductMappingUpdate {
  productCode?: string;
  description?: string;
  defaultUnitPrice?: number;
  defaultBillingMode?: "ITEMIZED" | "LUMP_SUM";
  taxCode?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}
