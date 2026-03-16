# Specification: AutoCount Invoice Integration (Node.js)

## 1. Project Overview
Build a Node.js Express service to orchestrate data from the INGLAB Partner API and generate a formatted Excel file for AutoCount bulk import.

## 2. Technical Stack
- Use existing project stacks 
- **Base URL:** https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB
- **Static Token:bda81890-f098-4998-85a8-358a2aeb6de1

##2.1 Orchestration Logic
When the generation endpoint is triggered:

1. **Fetch Client Master Data:** Call `GET /clients` to retrieve the current partner client list.
2. **Fetch Billable Data:** Call `GET /billable?period=YYYY-MM`.
3. **Master Record Lookup & Filtering:**
   - Iterate through items in the `/billable` response.
   - For each item, look up the `source_client_name` in the Master Data.
   - **Specific Rule:** If `source_client_name` is "AIA Malaysia", use:
     - **DebtorCode:** "300-0001"
     - **TaxEntity:** "Tax Entity: C20395547010"
     - **Address:** "Level 19, Menara AIA, 99, Jalan Ampang, 50450 Kuala Lumpur, Malaysia."
   - **General Rule:** If a client is NOT found in your lookup logic or is not "AIA Malaysia", the script should **ignore** that record (or skip it from the Excel export).

## 3. Implementation Workflow
The API endpoint (e.g., `GET /generate-excel?period=2026-03`) must perform the following:

### Step 1: Client Lookup
- Call `GET /clients` with the Bearer token.
- Fetch and store the list of available clients.

### Step 2: Fetch Billable Items
- Call `GET /billable?period={period}`.
- Iterate through the `items[]` array returned.

### Step 3: Transformation Logic (AIA Malaysia)
For each item, identify the `source_client_name`:
- **IF** `source_client_name` === "AIA Malaysia":
    - **DebtorCode:** "300-0001"
    - **TaxEntity:** "Tax Entity: C20395547010"
    - **Address:** "Level 19, Menara AIA, 99, Jalan Ampang, 50450 Kuala Lumpur, Malaysia."
- **ELSE:** Map fields based on standard API response (or leave defaults).

### Step 4: Field Mapping (Excel Rows)
| AutoCount Header | Value / Logic |
| :--- | :--- |
| DocNo | "<>" |
| DocDate / TaxDate | Current Date (DD/MM/YYYY) |
| SalesLocation | "HQ" |
| SalesAgent | "Darren Lim" |
| Credit Term | "Next 30 Days" |
| Description | "INVOICE" |
| InclusiveTax | "FALSE" |
| SubmitEInvoice | "FALSE" |
| ProductCode | "MODE-WA-API" |
| AccNo | "500-0000" |
| ClassificationCode | "22" |
| TaxCode | "SV-8" |
| DetailDescription | line_items.description |
| Qty | line_items.qty |
| Unit | line_items.unit |
| UnitPrice | line_items.unitprice |
| LocalTotalCost | line_items.totalAmount |

### Step 5: Mandatory Empty Headers
The Excel file MUST include these columns as empty placeholders:
TaxExemptionExpiryDate, PaymentMethod, PaymentRef, PaymentAmt, Email, EmailCC, EmailBCC, Attention, Phone1, Fax1, DeliverAddress, DeliverContact, DeliverPhone1, DeliverFax1, Ref, Note, Remark1, Remark2, Remark3, Remark4, CurrencyRate, ToTaxCurrencyRate, ToBankRate, ShippingRecipientTaxEntity, FreightAllowanceCharge, FreightAllowanceChargeReason, ReferenceNumberOfCustomsFormNo1And9, FreeTradeAgreementInformation, ReferenceNumberOfCustomsFormNo2, Incoterms, AuthorisationNumberForCertifiedExporter, EInvoiceIssueDateTime, EInvoiceUuid, ProductVariant, FurtherDescription, DeptNo, Discount, UnitType, TaxExportCountry, TaxPermitNo, TaxAdjustment, LocalTaxAdjustment, TariffCode, YourPONo, YourPODate, OriginCountry.

## 4. Acceptance Criteria
1. Service successfully authenticates using the provided Bearer token.
2. The `/clients` and `/billable` endpoints are called in sequence.
3. The AIA Malaysia specific mapping is applied correctly.
4. The output is a valid .xlsx file where one line_item = one row.
5. All 46+ mandatory headers are present in the final Excel file.

## 5. Deployment Note
Store the API token in a `.env` file as `API_TOKEN=ibda81890-f098-4998-85a8-358a2aeb6de1`.
