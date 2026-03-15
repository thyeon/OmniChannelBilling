---
phase: 01-add-email-line-item-to-coway-export
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - billing-app/src/domain/services/billingExportService.ts
autonomous: true
requirements:
  - EMAIL-01
  - EMAIL-02
  - EMAIL-03

must_haves:
  truths:
    - "User can see 2 line items (SMS and EMAIL) in preview for Coway"
    - "Export CSV contains both SMS and EMAIL rows"
    - "Email line item has correct rate and description"
  artifacts:
    - path: "billing-app/src/domain/services/billingExportService.ts"
      provides: "Billing export with both SMS and EMAIL line items"
      contains: "EMAIL line item logic"
  key_links:
    - from: "billingExportService.ts"
      to: "fetchEmailReconSummary"
      via: "import and call"
      pattern: "fetchEmailReconSummary"
---

<objective>
Add EMAIL as a second line item to Coway billing export CSV, alongside existing SMS. Export will produce 2 rows: SMS and EMAIL.
</objective>

<execution_context>
@/Users/thyeonyam/.claude/get-shit-done/workflows/execute-plan.md
@/Users/thyeonyam/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@billing-app/src/domain/services/billingExportService.ts
@billing-app/src/infrastructure/external/reconClient.ts
@billing-app/src/infrastructure/external/cowayClient.ts
@billing-app/src/types/index.ts

# Implementation Details from CONTEXT.md
- API endpoint: http://128.199.165.110:8080/invoice/findSentCount
- Rate: RM 0.11 per email
- Product code: "Email-Blast"
- Template: "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message."
</context>

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From billing-app/src/types/index.ts:
```typescript
export type ServiceType = 'SMS' | 'EMAIL' | 'WHATSAPP';

export interface Customer {
  name: string;
  rates: { [key in ServiceType]: number };
  serviceProductOverrides?: Array<{
    serviceType: ServiceType;
    productCode: string;
  }>;
  furtherDescriptionTemplate?: string;
}
```

From billing-app/src/domain/services/billingExportService.ts:
```typescript
// Already implemented function - just needs to be imported
export async function fetchEmailReconSummary(
  reconServer: ReconServer,
  billingMonth: string
): Promise<EmailReconApiResponse>
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add EMAIL line item to Coway export</name>
  <files>billing-app/src/domain/services/billingExportService.ts</files>
  <behavior>
    - Test 1: generatePreview("2026-01", "Coway (Malaysia) Sdn Bhd") returns 2 line items
    - Test 2: First line item has description "SMS-Enhanced", second has "Email-Blast"
    - Test 3: Email line item further_description contains "Email sent was" and "RM 0.11"
  </behavior>
  <action>
    Modify billingExportService.ts generatePreview function:

    1. After the existing SMS line item processing (lines 186-213), add EMAIL fetch and line item:

    ```typescript
    // Fetch email count from recon server
    const emailReconServer = customerConfig.reconServers?.find(
      (r: ReconServer) => r.type === "EMAIL"
    );
    let emailCount = 0;
    if (emailReconServer) {
      try {
        const emailData = await fetchEmailReconSummary(emailReconServer, period);
        emailCount = emailData.total || 0;
      } catch (error) {
        console.error("Failed to fetch email recon:", error);
        // Continue with 0 email count
      }
    }

    // Add EMAIL line item if count > 0
    if (emailCount > 0) {
      const emailRate = customerConfig.rates?.EMAIL || 0.11;
      const emailProductOverride = customerConfig.serviceProductOverrides?.find(
        (s: { serviceType: string; productCode: string }) => s.serviceType === "EMAIL"
      );
      const emailProductCode = emailProductOverride?.productCode || "Email-Blast";

      const emailTemplate = "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message.";
      const billingCycle = getBillingCycle(period);
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
    ```

    2. Add the import for fetchEmailReconSummary if not already present (it exists in this file already as lines 114-171)

    3. Ensure ReconServer type is imported from @/types
  </action>
  <verify>
    <automated>npm test -- --filter=billing 2>/dev/null || echo "No tests found - verify manually via API"</automated>
  </verify>
  <done>
    - Preview API returns 2 line items for Coway with billing period 2026-01
    - First line item: SMS-Enhanced with SMS count and rate
    - Second line item: Email-Blast with email count and RM 0.11 rate
    - Export CSV contains 2 rows
  </done>
</task>

</tasks>

<verification>
- Call generatePreview("2026-01", "Coway (Malaysia) Sdn Bhd") and verify data.length === 2
- Verify first line item description includes "SMS"
- Verify second line item description includes "Email"
- Verify exportBilling produces CSV with 2 rows
</verification>

<success_criteria>
1. Preview API returns 2 line items for Coway
2. Export CSV has SMS and EMAIL rows with correct data
3. Description template applied correctly for both line items
</success_criteria>

<output>
After completion, create `.planning/phases/01-add-email-line-item-to-coway-export/01-SUMMARY.md`
</output>
