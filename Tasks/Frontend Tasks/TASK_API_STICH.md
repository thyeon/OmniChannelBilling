Objective1 :  Integration & Navigation
Objective2 : Assemble the components into the main application shell and define the navigation structure.

Below are some references , you may improve it based on your implmentation needs and ask any questions if you are unsure or unclear.

Route: src/app/layout.tsx and src/app/page.tsx

Implementation Steps:

1. Layout: Ensure global providers are wrapped (QueryClientProvider for React Query).
2. Navigation: Create a simple Sidebar or Top Navbar with links:
- "Dashboard" (Home)
- "Billing" (Invoicing Tool)
- "Customers" (Master Data)

3. Billing Page Tabs:
- In src/app/billing/page.tsx, wrap the content from Section 4 (Generate Invoice) and Section 5 (History) into a Shadcn Tabs component.
- Tab 1 Label: "Generate Invoice".
- Tab 2 Label: "Invoice History".

4. Query Client Setup:
    - Create src/providers/query-provider.tsx.
    - Wrap children in <QueryClientProvider client={queryClient}>.

Final Check:

- Verify that imports match the file structure defined in previous sections.
- Ensure useCustomerStore is populated with dummy data on load for testing purposes if no backend exists yet.



## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
