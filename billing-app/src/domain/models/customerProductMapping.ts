export interface CustomerProductMapping {
  id: string;
  customerId: string;
  serviceType: 'SMS' | 'EMAIL' | 'WHATSAPP';
  lineIdentifier: string; // e.g., "DOMESTIC", "INTL", "WHATSAPP"
  productCode: string;
  description: string;
  furtherDescriptionTemplate: string;
  classificationCode: string;
  unit: string;
  accNo?: string;
  taxCode: string;
  billingMode: 'ITEMIZED' | 'LUMP_SUM';
  defaultUnitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export type CustomerProductMappingInput = Omit<CustomerProductMapping, 'id' | 'createdAt' | 'updatedAt'>;
export type CustomerProductMappingUpdate = Partial<Omit<CustomerProductMapping, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>;