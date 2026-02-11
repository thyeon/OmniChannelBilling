Objective:  Create the Next.js API route handlers that power the frontend functionality. Refer to the following for reference, you may need to adjust the logic based on your implementation and ask any questions if you are unsure or unclear.

File 1: src/app/api/usage/route.ts (GET)
Logic:

1. Accept Query Params: customerId, billingMonth.
2. Fetch Customer config to get API Keys/Endpoints.
3. Mock API Call 1: Get Reconciliation Data. Return { sent: 1000, failed: 5, withheld: 2 }.
4. Mock API Call 2: Get Provider Data. Return { total: 1005 }.
5. Return JSON object combining both.

File 2: src/app/api/invoices/generate/route.ts (POST)
Logic:

1. Accept Body: { customerId, billingMonth, billableItems: [{service, count, rate}] }.
2. Retrieve autocountCustomerId from Customer record.
3. Step A: Save Invoice to Local DB (Status: GENERATED).
4. Step B: Call AutoCount API (Mock this call).
5. Step C:
    - If Success: Update Status to SYNCED.
    - If Fail: Update Status to ERROR.
6. Return the final Invoice object.

File 3: src/app/api/history/route.ts (GET)
Logic:

1. Return a list of InvoiceHistory objects.
2. Support filtering by query params (status, customerId).


## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
