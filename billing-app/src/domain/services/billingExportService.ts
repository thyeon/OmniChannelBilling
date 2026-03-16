import { BillingClient } from "@/domain/models/billingClient";
import { BillingExportHistory } from "@/domain/models/billingExportHistory";
import { findAllBillingClients } from "@/infrastructure/db/billingClientRepository";
import { findAllBillingDefaults } from "@/infrastructure/db/billingDefaultsRepository";
import { insertExportHistory } from "@/infrastructure/db/billingExportHistoryRepository";
import { fetchIngLabBillable } from "@/infrastructure/external/inglabClient";
import { fetchCowayBillable, fetchWhatsAppBillable } from "@/infrastructure/external/cowayClient";
import { fetchEmailReconSummary } from "@/infrastructure/external/reconClient";
import { findAllCustomers } from "@/infrastructure/db/customerRepository";
import { Customer, ReconServer } from "@/types";

// Supported clients for export
const SUPPORTED_CLIENTS = [
  "AIA Malaysia",
  "Zurich Malaysia",
  "FWD Takaful",
  "Prudential Malaysia",
  "Pizza Hut",
  "Coway (Malaysia) Sdn Bhd",
];

// Default field values (fallback if DB is empty)
const DEFAULT_FIELD_VALUES: Record<string, string> = {
  sales_location: "HQ",
  sales_agent: "Darren Lim",
  credit_term: "Net 30 days",
  product_code: "MODE-WA-API",
  acc_no: "500-0000",
  classification_code: "'022",
  tax_code: "SV-8",
  inclusive_tax: "FALSE",
  submit_e_invoice: "FALSE",
};

// Mandatory empty CSV headers
const MANDATORY_EMPTY_HEADERS = [
  "TaxExemptionExpiryDate",
  "PaymentMethod",
  "PaymentRef",
  "PaymentAmt",
  "Email",
  "EmailCC",
  "EmailBCC",
  "Attention",
  "Phone1",
  "Fax1",
  "DeliverAddress",
  "DeliverContact",
  "DeliverPhone1",
  "DeliverFax1",
  "Ref",
  "Note",
  "Remark1",
  "Remark2",
  "Remark3",
  "Remark4",
  "CurrencyRate",
  "ToTaxCurrencyRate",
  "ToBankRate",
  "ShippingRecipientTaxEntity",
  "FreightAllowanceCharge",
  "FreightAllowanceChargeReason",
  "ReferenceNumberOfCustomsFormNo1And9",
  "FreeTradeAgreementInformation",
  "ReferenceNumberOfCustomsFormNo2",
  "Incoterms",
  "AuthorisationNumberForCertifiedExporter",
  "EInvoiceIssueDateTime",
  "EInvoiceUuid",
  "ProductVariant",
  "DeptNo",
  "Discount",
  "UnitType",
  "TaxExportCountry",
  "TaxPermitNo",
  "TaxAdjustment",
  "LocalTaxAdjustment",
  "TariffCode",
  "YourPONo",
  "YourPODate",
  "OriginCountry",
];

export interface PreviewRow {
  doc_no: string;
  doc_date: string;
  sales_location: string;
  sales_agent: string;
  credit_term: string;
  description: string;
  debtor_code: string;
  tax_entity: string;
  address: string;
  detail_description: string;
  further_description: string;
  qty: number;
  unit: number;
  unit_price: number;
  local_total_cost: number;
  product_code?: string;
  tax_code?: string;
}

export interface PreviewResult {
  period: string;
  clients: string[];
  total_rows: number;
  data: PreviewRow[];
}

export interface ExportResult {
  success: boolean;
  file_path?: string;
  row_count: number;
  client_name: string;
  error_message?: string;
}

/** Fetch defaults from DB or use defaults */
async function getFieldDefaults(): Promise<Record<string, string>> {
  try {
    const defaults = await findAllBillingDefaults();
    const defaultsMap: Record<string, string> = { ...DEFAULT_FIELD_VALUES };
    for (const def of defaults) {
      defaultsMap[def.field_name] = def.field_value;
    }
    return defaultsMap;
  } catch {
    return DEFAULT_FIELD_VALUES;
  }
}

/** Get client mappings from DB */
async function getClientMappings(): Promise<Map<string, BillingClient>> {
  const clients = await findAllBillingClients();
  const map = new Map<string, BillingClient>();
  for (const client of clients) {
    map.set(client.source_client_name, client);
  }
  return map;
}

/** Fetch customer config from MongoDB for Coway */
async function getCowayCustomerConfig(): Promise<Customer | undefined> {
  try {
    const customers = await findAllCustomers();
    return customers.find(c => c.name === "Coway (Malaysia) Sdn Bhd");
  } catch {
    return undefined;
  }
}

/** Resolve placeholders in template string */
function resolveTemplate(template: string, values: Record<string, string>): string {
  let resolved = template;
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return resolved;
}

/** Generate billing cycle string from period */
function getBillingCycle(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${monthNames[month - 1]} ${year}`;
}

/** Generate preview data for a given period and optional client filter */
export async function generatePreview(
  period: string,
  clientName?: string
): Promise<PreviewResult> {
  const defaults = await getFieldDefaults();
  const clientMappings = await getClientMappings();

  let billableItems;

  // Check if Coway is selected
  if (clientName === "Coway (Malaysia) Sdn Bhd") {
    // Fetch Coway-specific data
    const cowayItems = await fetchCowayBillable(period);

    // Get MongoDB customer config
    const customerConfig = await getCowayCustomerConfig();

    if (customerConfig && cowayItems.length > 0) {
      const item = cowayItems[0];
      const rate = customerConfig.rates?.SMS || 0.079;
      const productOverride = customerConfig.serviceProductOverrides?.find(
        (s: { serviceType: string; productCode: string }) => s.serviceType === "SMS"
      );
      const productCode = productOverride?.productCode || "SMS-Enhanced";
      const template = customerConfig.furtherDescriptionTemplate || "";

      // Format values for placeholder resolution
      const billingCycle = getBillingCycle(period);
      const smsCount = item.line_items[0].qty.toLocaleString();
      const smsRate = rate.toFixed(3);

      const resolvedDescription = resolveTemplate(template, {
        BillingCycle: billingCycle,
        SMSCount: smsCount,
        SMSRate: smsRate,
      });

      // Override line item with MongoDB config
      item.line_items[0] = {
        description: productCode,
        description_detail: resolvedDescription,
        qty: item.line_items[0].qty,
        unit_price: rate,
      };

      // Fetch WhatsApp count from WHATSAPP recon server (after SMS)
      const whatsappReconServer = customerConfig.reconServers?.find(
        (r: ReconServer) => r.type === "WHATSAPP"
      );
      if (whatsappReconServer) {
        try {
          const whatsappCount = await fetchWhatsAppBillable(period, whatsappReconServer);
          if (whatsappCount > 0) {
            const whatsappRate = customerConfig.rates?.WHATSAPP || 0.079;
            const whatsappProductOverride = customerConfig.serviceProductOverrides?.find(
              (s: { serviceType: string; productCode: string }) => s.serviceType === "WHATSAPP"
            );
            const whatsappProductCode = whatsappProductOverride?.productCode || "SMS-Enhanced";

            const whatsappTemplate = customerConfig.furtherDescriptionSMSIntl ||
              "For {BillingCycle}, the total number of International SMS messages sent via ECS Service was {SMSCount}, charged at RM {SMSRate} per message.";

            // Build values object - use SMSCount and SMSRate placeholders for the template
            const templateValues: Record<string, string> = {
              BillingCycle: billingCycle,
              SMSCount: whatsappCount.toLocaleString(),
              SMSRate: whatsappRate.toFixed(3),
            };

            const resolvedWhatsappDescription = resolveTemplate(whatsappTemplate, templateValues);

            // Add WhatsApp line item after SMS
            item.line_items.push({
              description: whatsappProductCode,
              description_detail: resolvedWhatsappDescription,
              qty: whatsappCount,
              unit_price: whatsappRate,
            });
          }
        } catch (error) {
          console.error("Failed to fetch WhatsApp billable for Coway:", error);
        }
      }

      // Fetch email count from recon server
      const emailReconServer = customerConfig.reconServers?.find(
        (r: ReconServer) => r.type === "EMAIL"
      );
      if (emailReconServer) {
        try {
          const emailData = await fetchEmailReconSummary(emailReconServer, period);
          const emailCount = emailData.count || 0;
          if (emailCount > 0) {
            const emailRate = customerConfig.rates?.EMAIL || 0.11;
            const emailProductOverride = customerConfig.serviceProductOverrides?.find(
              (s: { serviceType: string; productCode: string }) => s.serviceType === "EMAIL"
            );
            const emailProductCode = emailProductOverride?.productCode || "Email-Blast";

            const emailTemplate = customerConfig.invoiceDescriptionTemplate ||
              "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message.";
            const resolvedEmailDescription = resolveTemplate(emailTemplate, {
              BillingCycle: billingCycle,
              EmailCount: emailCount.toLocaleString(),
              EmailRate: emailRate.toFixed(2),
            });

            item.line_items.push({
              description: emailProductCode,
              description_detail: resolvedEmailDescription,
              qty: emailCount,
              unit_price: emailRate,
            });
          }
        } catch (error) {
          console.error("Failed to fetch email recon for Coway:", error);
        }
      }
    }

    // For Coway, we'll handle it directly below
    billableItems = cowayItems;
  } else {
    // Use INGLAB API for other clients
    billableItems = await fetchIngLabBillable(period);
  }

  // Filter items by supported clients and optional client filter
  const filteredItems = billableItems.filter((item: { source_client_name: string }) => {
    if (!SUPPORTED_CLIENTS.includes(item.source_client_name)) {
      return false;
    }
    if (clientName && clientName !== "all" && item.source_client_name !== clientName) {
      return false;
    }
    return true;
  });

  const result: PreviewResult = {
    period,
    clients: [],
    total_rows: 0,
    data: [],
  };

  // Track unique clients
  const clientSet = new Set<string>();

  // Current date for DocDate and TaxDate
  const now = new Date();
  const docDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  for (const item of filteredItems) {
    clientSet.add(item.source_client_name);
    const clientMapping = clientMappings.get(item.source_client_name);

    if (!clientMapping) {
      continue; // Skip if no mapping found
    }

    // Process each line item - skip items where qty is 0 or null
    for (let lineIndex = 0; lineIndex < item.line_items.length; lineIndex++) {
      const lineItem = item.line_items[lineIndex];

      // Skip line_items where qty is 0 or null (per business rule)
      if (lineItem.qty === null || lineItem.qty === 0) {
        continue;
      }

      const qty = lineItem.qty;
      const unitPrice = lineItem.unit_price;
      const localTotalCost = qty * unitPrice;

      // DocNo: "<<New>>" only for first line item of each bill
      const docNo = lineIndex === 0 ? "<<New>>" : "";

      const row: PreviewRow = {
        doc_no: docNo,
        doc_date: docDate,
        sales_location: defaults.sales_location,
        sales_agent: defaults.sales_agent,
        credit_term: defaults.credit_term,
        description: "INVOICE",
        debtor_code: clientMapping.debtor_code,
        tax_entity: clientMapping.tax_entity,
        address: clientMapping.address,
        detail_description: lineItem.description || "",
        further_description: (lineItem.description_detail || "").replace(/\n/g, " | "),
        qty,
        unit: qty,
        unit_price: unitPrice,
        local_total_cost: Math.round(localTotalCost * 100) / 100,
        product_code: lineItem.description || defaults.product_code,
        tax_code: clientMapping.tax_code,
      };

      result.data.push(row);
    }
  }

  result.clients = Array.from(clientSet);
  result.total_rows = result.data.length;

  return result;
}

/** Generate CSV content from preview data */
export function generateCSV(data: PreviewRow[]): string {
  const headers = [
    "DocNo",
    "DocDate",
    "TaxDate",
    "SalesLocation",
    "SalesAgent",
    "CreditTerm",
    "Description",
    "DebtorCode",
    "TaxEntity",
    "Address",
    "InclusiveTax",
    "SubmitEInvoice",
    "ProductCode",
    "AccNo",
    "ClassificationCode",
    "TaxCode",
    "DetailDescription",
    "FurtherDescription",
    "Qty",
    "Unit",
    "UnitPrice",
    "LocalTotalCost",
    ...MANDATORY_EMPTY_HEADERS,
  ];

  const rows = data.map((row) => {
    const values = [
      row.doc_no,
      row.doc_date,
      row.doc_date, // TaxDate = DocDate
      row.sales_location,
      row.sales_agent,
      row.credit_term,
      row.description,
      row.debtor_code,
      row.tax_entity,
      row.address,
      "FALSE", // InclusiveTax
      "FALSE", // SubmitEInvoice
      row.product_code || "MODE-WA-API", // ProductCode
      "500-0000", // AccNo
      "'022", // ClassificationCode
      row.tax_code || "SV-8", // TaxCode
      row.detail_description,
      row.further_description,
      row.qty.toString(),
      row.unit.toString(),
      row.unit_price.toString(),
      row.local_total_cost.toString(),
    ];

    // Add empty values for mandatory headers
    for (let i = 0; i < MANDATORY_EMPTY_HEADERS.length; i++) {
      values.push("");
    }

    // Escape values and handle empty fields
    return values.map((v) => {
      if (v === "" || v === undefined || v === null) {
        return "";
      }
      // Escape double quotes by doubling them
      const escaped = v.toString().replace(/"/g, '""');
      // Wrap in quotes if contains comma, quote, or newline
      if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
        return `"${escaped}"`;
      }
      return escaped;
    }).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/** Export billing data and save to history */
export async function exportBilling(
  period: string,
  clientName: string,
  mode: "download" | "save",
  filePath?: string
): Promise<ExportResult> {
  const preview = await generatePreview(period, clientName);

  if (preview.total_rows === 0) {
    return {
      success: false,
      row_count: 0,
      client_name: clientName,
      error_message: "No data found for the selected period and client",
    };
  }

  // Generate CSV (used in download mode)
  generateCSV(preview.data);

  // Save history record
  const historyRecord: BillingExportHistory = {
    period,
    client_name: clientName === "all" ? "All Clients" : clientName,
    status: "success",
    row_count: preview.total_rows,
    file_path: filePath,
  };

  await insertExportHistory(historyRecord);

  return {
    success: true,
    file_path: filePath,
    row_count: preview.total_rows,
    client_name: clientName,
  };
}

/** Get supported clients list */
export function getSupportedClients(): string[] {
  return SUPPORTED_CLIENTS;
}
