/**
 * AutoCount Account Book Configuration
 *
 * Represents an AutoCount Cloud Accounting account book with its credentials
 * and default settings. Multiple customers can be linked to the same account book.
 */

export interface AutoCountAccountBook {
  id: string;
  name: string;
  accountBookId: string;
  keyId: string;
  apiKey: string;
  defaultCreditTerm: string;
  defaultSalesLocation: string;
  defaultTaxCode?: string;
  taxEntity?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoCountAccountBookInput {
  name: string;
  accountBookId: string;
  keyId: string;
  apiKey: string;
  defaultCreditTerm: string;
  defaultSalesLocation: string;
  defaultTaxCode?: string;
  taxEntity?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}

export interface AutoCountAccountBookUpdate {
  name?: string;
  accountBookId?: string;
  keyId?: string;
  apiKey?: string;
  defaultCreditTerm?: string;
  defaultSalesLocation?: string;
  defaultTaxCode?: string;
  taxEntity?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}
