Objective:  1. Create the main billing interface with the "High Level Journey" logic, specifically handling the configurable discrepancy thresholds. refer to the following for a start, improve and enhance if there is a need. Ask any questions if you need clarification.

Route: src/app/billing/page.tsx

Core Logic (JavaScript/TypeScript Implementation):

// Discrepancy Calculation Logic
const checkDiscrepancy = (reconTotal: number, providerTotal: number, threshold: number) => {
  if (reconTotal === 0) return { isMismatch: false, diff: 0 };
  
  const diff = providerTotal - reconTotal;
  const diffPercentage = (diff / reconTotal) * 100;
  
  // Check if provider count is HIGHER than recon count by more than the threshold %
  const isMismatch = diffPercentage > threshold;
  
  return { isMismatch, diffPercentage, diff };
};

UI Layout Specifications:

1. Control Panel:
- Dropdown to select Customer (populated from Store).
-Month Picker.
Button: "Fetch Data".
2. Service Cards (One per service subscribed):
- Top Section: Two columns.
    - Left: Reconciliation Data (Sent, Failed, Withheld).
    - Right: Provider Total Count.
- Logic/Alert Section (Crucial):

    - If isMismatch is False: Show Green Check Badge. Text: "Counts matched. Discrepancy within limit." Input for Billable Count is pre-filled with Provider Total and Disabled.
    - If isMismatch is True: Show Red Alert Triangle. Text: "Alert: Provider count is higher than Recon by X%." Input for Billable Count defaults to Recon Total (Safer). Input is enabled for editing. Checkbox: "Force use Provider Count".
- Bottom Section:
    - Rate display.
    - Total Charge Out = Billable Count * Rate.
3. Footer Actions:
- Display Grand Total.
- Generate Invoice Button:
    -Enabled only if Customer.billingMode === 'MANUAL'.
If AUTO_PILOT, button is disabled with text "Scheduled for [Date]".



## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
