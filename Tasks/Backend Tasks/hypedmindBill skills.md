## 1. Supported Clients

Only the following clients are processed (others are excluded):
- AIA Malaysia
- Zurich Malaysia

## 2. Client Master Data Mapping

| source_client_name | DebtorCode | TaxEntity | Address |
|--------------------|------------|-----------|---------|
| AIA Malaysia | 300-0001 | TIN:C20395547010 | Level 19 Menara AIA 99 Jalan Ampang 50450 Kuala Lumpur Malaysia |
| Zurich Malaysia | 300-H002 | TIN:C25196213100 | Level 23A Mercu 3 Jalan Bangsar KL Eco City 59200 Kuala Lumpur |
| FWD Takaful | 300-F001 | TIN:C12166642050 | Level 21, Mercu 2, No. 3, KL Eco City, Jalan Bangsar, 59200 Kuala Lumpur. |
| Prudential Malaysia| 300-H003 | TIN:C2899590020 | Level 20, Menara Prudential, Persiaran TRX Barat,Tun Razak Exchange,55188 Kuala Lumpur. |
| Pizza Hut| 300-P001 | TIN:C3855039030 | Level 13A Tower 1,VSquare @ PJ City Centre, Jalan Utara, 46200 Petaling Jaya, Selangor, Malaysia. |

## 3. Implementation Workflow

### Step 1: Fetch Client Master Data
Call `GET /clients` to retrieve the current partner client list.

### Step 2: Fetch Billable Data
Call `GET /billable?period=YYYY-MM`.

### Step 3: Filter and Transform
Iterate through items in the `/billable` response. For each item, look up the `source_client_name`:

- **IF** `source_client_name` === "AIA Malaysia":
  - DebtorCode: "300-0001"
  - TaxEntity: "TIN:C20395547010"
  - Address: "Level 19 Menara AIA 99 Jalan Ampang 50450 Kuala Lumpur Malaysia"

- **IF** `source_client_name` === "Zurich Malaysia":
  - DebtorCode: "300-H002"
  - TaxEntity: "TIN:C25196213100"
  - Address: "Level 23A Mercu 3 Jalan Bangsar KL Eco City 59200 Kuala Lumpur"

- **ELSE:** Skip this record (do not include in export)

**Business Rule:** After filtering by client, also skip any `line_items` where `qty` is `0` or `null`. Only include line_items with qty > 0.

### Step 4: Field Mapping (CSV Rows)

| AutoCount Header | Value / Logic |
| :--- | :--- |
| DocNo | "<<New>>" for first line_item (index 0) of each bill, empty string "" for subsequent line_items |
| DocDate | Current date in DD/MM/YYYY format |
| TaxDate | Current date in DD/MM/YYYY format |
| SalesLocation | "HQ" |
| SalesAgent | "Darren Lim" |
| CreditTerm | "Net 30 days" |
| Description | "INVOICE" |
| DebtorCode | From client mapping |
| TaxEntity | From client mapping |
| Address | From client mapping |
| InclusiveTax | "FALSE" |
| SubmitEInvoice | "FALSE" |
| ProductCode | "MODE-WA-API" |
| AccNo | "500-0000" |
| ClassificationCode | "022" (prefix with single quote "'022" for text format in CSV) |
| TaxCode | "SV-8" |
| DetailDescription | line_items.description |
| FurtherDescription | line_items.description_detail |
| Qty | line_items.qty (if null, use 0) |
| Unit | line_items.qty (if null, use 0) |
| UnitPrice | line_items.unit_price |
| LocalTotalCost | line_items.qty × line_items.unit_price (if qty is null, treat as 0) |
| ToBankRate | "1.000000" (hardcoded) |

### Step 5: CSV Column Rules (IMPORTANT)

1. **Empty fields:** Always use single comma (`,`) for empty fields. Never skip a field - this causes column shifting.
   - Correct: `,value2,value3`
   - Wrong: `,,value3` (causes column shift)

2. **DocNo Logic:** Only the FIRST line_item (index 0) of each parent billable item gets "<<New>>", all subsequent line_items get empty string.

3. **Null qty handling:** If line_items.qty is null, treat as 0 for Qty, Unit, and LocalTotalCost calculations.

### Step 6: Mandatory Empty Headers

The CSV file MUST include these columns as empty (single comma):

TaxExemptionExpiryDate, PaymentMethod, PaymentRef, PaymentAmt, Email, EmailCC, EmailBCC, Attention, Phone1, Fax1, DeliverAddress, DeliverContact, DeliverPhone1, DeliverFax1, Ref, Note, Remark1, Remark2, Remark3, Remark4, CurrencyRate, ToTaxCurrencyRate, ShippingRecipientTaxEntity, FreightAllowanceCharge, FreightAllowanceChargeReason, ReferenceNumberOfCustomsFormNo1And9, FreeTradeAgreementInformation, ReferenceNumberOfCustomsFormNo2, Incoterms, AuthorisationNumberForCertifiedExporter, EInvoiceIssueDateTime, EInvoiceUuid, ProductVariant, DeptNo, Discount, UnitType, TaxExportCountry, TaxPermitNo, TaxAdjustment, LocalTaxAdjustment, TariffCode, YourPONo, YourPODate, OriginCountry

## 4. CSV Output

Save the CSV file with name format:
`INGLAB_Billing_{PERIOD}_{CLIENT}.csv` (e.g., `INGLAB_Billing_2026-01_Zurich.csv`)
