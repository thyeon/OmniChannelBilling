#Billing Automation System - System Requirements Specification

**Project Name:** Billing Automation System  
**Version:** 1.0  
**Prepared By:** System Analyst (Vibe Coding)  
**Date:** October 26, 2023  

---

## 1. Context

### 1.1 Overview
The Billing Automation System is a web-based platform designed to streamline the invoicing process for communication services (SMS, Email, and eventually WhatsApp). The system bridges the gap between service usage data and financial accounting by aggregating data from Service Providers and an internal Reconciliation Server, calculating costs based on configurable rates, and automatically generating invoices within the AutoCount Cloud ecosystem.

### 1.2 Business Problem
Currently, the manual retrieval of usage counts, reconciliation against internal logs, and manual data entry into the accounting system is time-consuming and prone to human error. The system aims to automate the "Retrieve -> Reconcile -> Calculate -> Invoice" workflow.

### 1.3 Key Objectives
1.  **Automation:** Eliminate manual CSV handling and data entry.
2.  **Accuracy:** Implement logic to flag discrepancies between provider data and internal logs.
3.  **Flexibility:** Support multiple service providers and customer-specific rates.
4.  **Integration:** Seamless integration with AutoCount Cloud for accounting.

---

## 2. Data Assumption

### 2.1 Customer Data
*   Each Customer has a unique internal ID and a corresponding **AutoCount Customer ID** (mapping is stored in the system).
*   Customers subscribe to one or more services (SMS, Email).
*   Rates are configured per customer and per service type.

### 2.2 Usage Data Sources
*   **Reconciliation Server:** Provides granular data: `Total Sent`, `Failed`, and `Withheld` counts.
*   **Service Provider:** Provides a single `Total Count` (billable units consumed).
*   **Data Retrieval:** Both sources are accessible via REST API requiring Authentication (API Keys).

### 2.3 Billing Logic
*   **Currency:** The system assumes a single base currency for calculation (e.g., USD/MYR). Multi-currency support is out of scope.
*   **Time Period:** Billing is strictly performed on a monthly basis (Usage Month).
*   **Thresholds:** Discrepancy thresholds are stored as percentage values (e.g., 1.5%).

### 2.4 System State
*   **Manual Mode:** Invoice generation is triggered by a user action.
*   **Auto Pilot Mode:** Invoice generation is scheduled for a specific day of the month (logic restricted in UI for manual runs).

---

## 3. Acceptance Check List

### 3.1 Customer Master Module
- [ ] **CRUD Operations:** Admin can Add, Edit, and View customers.
- [ ] **Service Mapping:** Admin can select which services (SMS/Email) a customer subscribes to.
- [ ] **Provider Config:** Admin can input API Keys and Endpoints for specific providers per customer.
- [ ] **Rate Configuration:** Admin can set specific rates per unit (SMS/Email) for each customer.
- [ ] **AutoCount Mapping:** Admin can manually input the `AutoCount Customer ID` for the integration.

### 3.2 Configuration & Thresholds
- [ ] **Discrepancy Threshold:** Admin can set a percentage threshold (e.g., 1%) for each customer.
- [ ] **Billing Mode:** Admin can toggle between `MANUAL` and `AUTO_PILOT` modes.
- [ ] **Scheduling:** If `AUTO_PILOT` is selected, Admin can set the specific day of the month (1-31) for generation.
- [ ] **Consolidation:** Admin can choose to consolidate all services into one invoice or split them by service type.

### 3.3 Invoicing Workflow (Manual Mode)
- [ ] **Data Retrieval:** System successfully fetches data from both Reconciliation Server and Service Provider for a selected month.
- [ ] **Data Display:** System displays:
    - Recon Server: Sent, Failed, Withheld.
    - Provider: Total Count.
- [ ] **Discrepancy Logic (Pass):** If `Provider Count <= Recon Count + Threshold`, system auto-approves the Provider Count for billing and displays a "Verified" status.
- [ ] **Discrepancy Logic (Fail):** If `Provider Count > Recon Count + Threshold`:
    - System displays a Warning Alert.
    - System highlights the percentage difference.
    - Billable input field defaults to `Recon Count` (Safe mode).
    - Admin can manually override the count.
- [ ] **Calculation:** Total Charge = `Billable Count * Configured Rate`.
- [ ] **Generation:** "Generate Invoice" button creates the invoice record and attempts to sync with AutoCount.

### 3.4 Integration & History
- [ ] **AutoCount Sync:** Upon generation, system sends invoice data to AutoCount using the mapped ID.
- [ ] **Status Tracking:** System tracks invoice status: `DRAFT`, `GENERATED`, `SYNCED`, `ERROR`.
- [ ] **History Tab:** Admin can view a list of past invoices with filters (Date, Status, Customer).
- [ ] **Error Handling:** If AutoCount sync fails, status is marked `ERROR`, and a "Retry Sync" button becomes available.

---

## 4. Out of Scope

1.  **Payment Collection:** The system generates invoices in AutoCount; it does not process credit card payments or send payment links to end customers.
2.  **WhatsApp Module:** While the data structure supports it, the UI and specific API integration for WhatsApp will not be developed in Phase 1.
3.  **User Role Management (RBAC):** The system will assume a single "Admin" role. granular permissions (e.g., "View Only" vs "Accountant") are not included.
4.  **Bulk Import:** Customers must be added manually via the UI. CSV/Excel bulk upload is not supported.
5.  **Tax Calculation:** Tax logic (VAT/GST/SST) is assumed to be handled within AutoCount, not calculated in this middleware.
6.  **Provider API Debugging:** The system consumes APIs; it does not provide a tool to debug or test the external provider APIs directly.

---

## 5. Constraints

### 5.1 Technical Constraints
*   **Tech Stack:** Must strictly use **Next.js 14+ (App Router)**, **React 18+**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui**.
*   **State Management:** Must use **Zustand** for client state and **React Query** for server state.
*   **Deployment:** Designed for a Vercel or Node.js server environment.

### 5.2 Functional Constraints
*   **API Limits:** The system is dependent on the rate limits and uptime of the SMS/Email Service Providers. Queuing mechanisms for API failures are out of scope (basic retry only).
*   **Historical Rates:** When rates are updated for a customer, the system applies the *current* rate to the *current* billing cycle. It does not maintain a historical rate table (retroactive billing requires manual DB intervention).
*   **Date Handling:** "Billing Month" logic relies on standard calendar months. Custom billing cycles (e.g., 15th of Month to 14th of next month) are not supported.

### 5.3 Usability Constraints
*   **Browser Support:** Modern browsers (Chrome, Firefox, Edge, Safari) - Last 2 versions only. IE11 is not supported.
*   **Responsive Design:** The application must be fully responsive, though complex data tables are optimized for Desktop/Tablet views.
