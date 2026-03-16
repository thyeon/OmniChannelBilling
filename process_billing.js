const fs = require('fs');

// Client mapping
const clientMapping = {
  'AIA Malaysia': { DebtorCode: '300-0001', TaxEntity: 'TIN:C20395547010', Address: 'Level 19 Menara AIA 99 Jalan Ampang 50450 Kuala Lumpur Malaysia' },
  'Zurich Malaysia': { DebtorCode: '300-H002', TaxEntity: 'TIN:C25196213100', Address: 'Level 23A Mercu 3 Jalan Bangsar KL Eco City 59200 Kuala Lumpur' },
  'FWD Takaful': { DebtorCode: '300-F001', TaxEntity: 'TIN:C12166642050', Address: 'Level 21, Mercu 2, No. 3, KL Eco City, Jalan Bangsar, 59200 Kuala Lumpur.' },
  'Prudential Malaysia': { DebtorCode: '300-H003', TaxEntity: 'TIN:C2899590020', Address: 'Level 20, Menara Prudential, Persiaran TRX Barat, Tun Razak Exchange, 55188 Kuala Lumpur.' },
  'Pizza Hut': { DebtorCode: '300-P001', TaxEntity: 'TIN:C3855039030', Address: 'Level 13A Tower 1, VSquare @ PJ City Centre, Jalan Utara, 46200 Petaling Jaya, Selangor, Malaysia.' }
};

// Filter to specific clients (empty array = all clients)
const filterClients = [];

// Current date
const currentDate = '13/03/2026';

// Empty headers that must be included
const emptyHeaders = [
  'TaxExemptionExpiryDate', 'PaymentMethod', 'PaymentRef', 'PaymentAmt', 'Email', 'EmailCC', 'EmailBCC',
  'Attention', 'Phone1', 'Fax1', 'DeliverAddress', 'DeliverContact', 'DeliverPhone1', 'DeliverFax1',
  'Ref', 'Note', 'Remark1', 'Remark2', 'Remark3', 'Remark4', 'CurrencyRate', 'ToTaxCurrencyRate',
  'ShippingRecipientTaxEntity', 'FreightAllowanceCharge', 'FreightAllowanceChargeReason',
  'ReferenceNumberOfCustomsFormNo1And9', 'FreeTradeAgreementInformation', 'ReferenceNumberOfCustomsFormNo2',
  'Incoterms', 'AuthorisationNumberForCertifiedExporter', 'EInvoiceIssueDateTime', 'EInvoiceUuid',
  'ProductVariant', 'DeptNo', 'Discount', 'UnitType', 'TaxExportCountry', 'TaxPermitNo', 'TaxAdjustment',
  'LocalTaxAdjustment', 'TariffCode', 'YourPONo', 'YourPODate', 'OriginCountry'
];

function generateCSV(data, period) {
  const items = data.items;
  const rows = [];

  // CSV headers
  const headers = [
    'DocNo', 'DocDate', 'TaxDate', 'SalesLocation', 'SalesAgent', 'CreditTerm', 'Description',
    'DebtorCode', 'TaxEntity', 'Address', 'InclusiveTax', 'SubmitEInvoice', 'ProductCode',
    'AccNo', 'ClassificationCode', 'TaxCode', 'DetailDescription', 'FurtherDescription',
    'Qty', 'Unit', 'UnitPrice', 'LocalTotalCost', 'ToBankRate'
  ].concat(emptyHeaders);

  rows.push(headers.join(','));

  let billItemIndex = 0;

  for (const item of items) {
    const clientName = item.source_client_name;

    // Skip if client not in mapping or not in filter (if filter is set)
    if (!clientMapping[clientName]) {
      continue;
    }
    if (filterClients.length > 0 && !filterClients.includes(clientName)) {
      continue;
    }

    const client = clientMapping[clientName];
    const lineItems = (item.line_items || []).filter(li => li.qty && li.qty > 0);

    for (let i = 0; i < lineItems.length; i++) {
      const lineItem = lineItems[i];
      // DocNo: "<<New>>" for first line_item of each billable item, empty for rest
      const docNo = (i === 0) ? '<<New>>' : '';

      const qty = lineItem.qty || 0;
      const unitPrice = lineItem.unit_price || 0;
      const localTotalCost = qty * unitPrice;

      const row = [
        docNo,
        currentDate,
        currentDate,
        'HQ',
        'Darren Lim',
        'Net 30 days',
        'INVOICE',
        client.DebtorCode,
        client.TaxEntity,
        `"${client.Address}"`,
        'FALSE',
        'FALSE',
        'MODE-WA-API',
        '500-0000',
        "'022",
        'SV-8',
        `"${(lineItem.description || '').replace(/"/g, '""')}"`,
        `"${(lineItem.description_detail || '').replace(/"/g, '""')}"`,
        qty,
        qty,
        unitPrice.toFixed(4),
        localTotalCost.toFixed(4),
        '1.000000'
      ];

      // Add empty values for remaining headers
      for (let j = 0; j < emptyHeaders.length; j++) {
        row.push('');
      }

      rows.push(row.join(','));
      billItemIndex++;
    }
  }

  return rows.join('\n');
}

// Process each period
const fileMap = {
  '2025-12': '/Users/thyeonyam/.claude/projects/-Users-thyeonyam-Desktop-YTO-doc-BillingSolutions/a59c12d4-4f8d-43a5-837d-4fd6a715f0b8/tool-results/call_function_p9x7sq6ymvys_2.txt',
  '2026-01': '/Users/thyeonyam/.claude/projects/-Users-thyeonyam-Desktop-YTO-doc-BillingSolutions/a59c12d4-4f8d-43a5-837d-4fd6a715f0b8/tool-results/call_function_p9x7sq6ymvys_3.txt',
  '2026-02': '/Users/thyeonyam/.claude/projects/-Users-thyeonyam-Desktop-YTO-doc-BillingSolutions/a59c12d4-4f8d-43a5-837d-4fd6a715f0b8/tool-results/call_function_p9x7sq6ymvys_4.txt'
};

const periods = ['2025-12', '2026-01', '2026-02'];

for (const period of periods) {
  try {
    const content = fs.readFileSync(fileMap[period], 'utf8');
    const data = JSON.parse(content);
    const csv = generateCSV(data, period);

    // Build filename based on filter
    const clientFilterStr = filterClients.length > 0 ? '_' + filterClients.map(c => c.replace(/\s+/g, '')).join('_') : '';
    const outputPath = `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/INGLAB_Billing_${period}${clientFilterStr}.csv`;
    fs.writeFileSync(outputPath, csv);

    // Count rows (with filter applied)
    const filterFn = (i) => {
      if (!clientMapping[i.source_client_name]) return false;
      if (filterClients.length > 0 && !filterClients.includes(i.source_client_name)) return false;
      return true;
    };
    const filteredItems = data.items.filter(filterFn);
    const lineItemCount = filteredItems.reduce((sum, item) => sum + (item.line_items?.length || 0), 0);

    console.log(`Generated ${outputPath}`);
    console.log(`  - Filtered billable items: ${filteredItems.length}`);
    console.log(`  - Total CSV rows (excluding header): ${lineItemCount}`);
  } catch (err) {
    console.error(`Error processing ${period}:`, err.message);
  }
}
