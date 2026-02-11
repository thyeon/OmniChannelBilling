Objective:  1. Objective: Build the UI to manage customers, including the specific requirements for AutoCount ID mapping and Discrepancy Threshold configuration.

Route: src/app/customers/page.tsx

UI Specifications:

Page Layout:
Header with Title "Customer Management" and "Add Customer" button.
Table listing existing customers.
Add/Edit Dialog (Sheet):
General Info: Inputs for Customer Name and AutoCount Customer ID.
Services: Checkboxes for SMS, Email, Whatsapp.
Providers: Dynamic section to add API Keys/Endpoints based on selected services.
Rates & Thresholds:
Number inputs for SMS Rate and Email Rate.
Discrepancy Threshold: Number input (step 0.01) with a "%" suffix. Default value 1.00.
Billing Settings: Switch for Consolidate Invoice, Switch for Billing Mode (Manual/Auto), Date picker for Schedule.
Implementation Instructions:

Use useCustomerStore to fetch/save data.
Use Sheet component for the Add/Edit form to ensure maximum screen real estate.
Ensure autocountCustomerId and discrepancyThreshold are strictly validated as required fields.

## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
