Objective:  Objective: Create a view to track generated invoices and their synchronization status with AutoCount.

Route: src/app/history/page.tsx (or embedded in a Tab)

UI Layout Specifications:

1. Filter Bar:
- Input: Search by Customer Name.
- Select: Status Filter (ALL, SYNCED, ERROR, DRAFT).
- Date Range Picker.
2. Data Table:
- Columns:
    - Invoice Date (dd/MM/yyyy)
    - Customer Name
    - Billing Month (e.g., "Oct 2023")
    - Total Amount (Formatted Currency)
    - AutoCount Ref ID (Visible only if Synced)
    - Status (Badge):
        - Synced: Green Background, Dark Green Text.
        - Error: Red Background, White Text.
        - Draft: Gray/Slate.
    - Actions:
        - Button: "View Details" (Opens Dialog with line items).
        - Button: "Retry Sync" (Visible ONLY if Status is ERROR).

Data Structure Required:
Fetch data of type InvoiceHistory[] (referenced in Types section) from the API.


## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
