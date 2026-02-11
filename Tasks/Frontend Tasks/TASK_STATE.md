Objective:  1. Objective: Implement client-side state management to handle Customer lists and the specific workflow states for the Billing module, refer to the following for a start, improve and enhance if there is a need. Ask any questions if you need clarification.

import { create } from 'zustand';
import { Customer } from '@/types';

interface CustomerStore {
  customers: Customer[];
  selectedCustomer: Customer | null;
  setCustomers: (customers: Customer[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updatedCustomer: Customer) => void;
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: [],
  selectedCustomer: null,
  setCustomers: (customers) => set({ customers }),
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
  addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
  updateCustomer: (id, updatedCustomer) =>
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? updatedCustomer : c)),
    })),
}));


## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
