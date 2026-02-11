Objective:  1. Objective: Implement client-side state management to handle the specific workflow states for the Billing module, refer to the following for a start, improve and enhance if there is a need. Ask any questions if you need clarification.

import { create } from 'zustand';
import { UsageData, InvoiceHistory } from '@/types';

interface BillingStore {
  billingMonth: Date;
  usageData: UsageData[];
  isLoading: boolean;
  setBillingMonth: (date: Date) => void;
  setUsageData: (data: UsageData[]) => void;
  updateBillableCount: (service: ServiceType, count: number) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useBillingStore = create<BillingStore>((set) => ({
  billingMonth: new Date(),
  usageData: [],
  isLoading: false,
  setBillingMonth: (date) => set({ billingMonth: date }),
  setUsageData: (data) => set({ usageData: data }),
  updateBillableCount: (service, count) =>
    set((state) => ({
      usageData: state.usageData.map((item) =>
        item.service === service
          ? { ...item, billableCount: count, totalCharge: count * item.rate }
          : item
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({ usageData: [], billingMonth: new Date() }),
}));


## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
