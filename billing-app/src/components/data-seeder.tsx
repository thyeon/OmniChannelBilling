"use client";

import { useEffect, useRef } from "react";
import { useCustomerStore } from "@/store/useCustomerStore";
import { Customer } from "@/types";

const SEED_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    name: "Acme Corp",
    autocountCustomerId: "AC-ACME-001",
    services: ["SMS", "EMAIL"],
    providers: [
      { id: "prov-1", name: "Twilio", type: "SMS", apiKey: "sk_test_sms", apiEndpoint: "https://api.twilio.com/v1" },
      { id: "prov-2", name: "SendGrid", type: "EMAIL", apiKey: "sk_test_email", apiEndpoint: "https://api.sendgrid.com/v3" },
    ],
    reconServers: [
      { id: "recon-1", name: "SMS Recon Primary", type: "SMS", userId: "acme_sms_user", apiKey: "rk_test_sms", apiEndpoint: "https://recon.acme.internal/sms" },
      { id: "recon-2", name: "Email Recon Primary", type: "EMAIL", userId: "acme_email_user", apiKey: "rk_test_email", apiEndpoint: "https://recon.acme.internal/email" },
    ],
    rates: { SMS: 0.05, EMAIL: 0.02, WHATSAPP: 0 },
    billingMode: "MANUAL",
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    consolidateInvoice: true,
    discrepancyThreshold: 1.0,
  },
  {
    id: "cust-002",
    name: "Beta Industries",
    autocountCustomerId: "AC-BETA-002",
    services: ["SMS", "EMAIL", "WHATSAPP"],
    providers: [
      { id: "prov-3", name: "Vonage", type: "SMS", apiKey: "sk_test_sms2", apiEndpoint: "https://api.vonage.com/v1" },
      { id: "prov-4", name: "Mailgun", type: "EMAIL", apiKey: "sk_test_email2", apiEndpoint: "https://api.mailgun.net/v3" },
      { id: "prov-5", name: "WhatsApp Business", type: "WHATSAPP", apiKey: "sk_test_wa", apiEndpoint: "https://graph.facebook.com/v17" },
    ],
    reconServers: [
      { id: "recon-3", name: "Beta SMS Recon", type: "SMS", userId: "beta_sms_user", apiKey: "rk_test_sms2", apiEndpoint: "https://recon.beta.io/sms" },
      { id: "recon-4", name: "Beta Email Recon", type: "EMAIL", userId: "beta_email_user", apiKey: "rk_test_email2", apiEndpoint: "https://recon.beta.io/email" },
      { id: "recon-5", name: "Beta WA Recon", type: "WHATSAPP", userId: "beta_wa_user", apiKey: "rk_test_wa", apiEndpoint: "https://recon.beta.io/whatsapp" },
    ],
    rates: { SMS: 0.04, EMAIL: 0.015, WHATSAPP: 0.08 },
    billingMode: "AUTO_PILOT",
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    schedule: { dayOfMonth: 15, time: "09:00", retryIntervalMinutes: 30, maxRetries: 3 },
    consolidateInvoice: false,
    discrepancyThreshold: 1.5,
  },
  {
    id: "cust-003",
    name: "Gamma Solutions",
    autocountCustomerId: "AC-GAMMA-003",
    services: ["EMAIL"],
    providers: [],
    reconServers: [
      { id: "recon-6", name: "Gamma Email Recon", type: "EMAIL", userId: "gamma_email_user", apiKey: "rk_test_ses", apiEndpoint: "https://recon.gamma.co/email" },
    ],
    rates: { SMS: 0, EMAIL: 0.01, WHATSAPP: 0 },
    billingMode: "MANUAL",
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    consolidateInvoice: true,
    discrepancyThreshold: 2.0,
  },
];

/** Syncs seed customers to MongoDB via the API. */
async function syncCustomersToDb(customers: Customer[]): Promise<void> {
  for (const customer of customers) {
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
    } catch (error) {
      console.error(`Failed to sync customer ${customer.id} to DB:`, error);
    }
  }
}

/** Seeds the customer store with dummy data on first mount if DB is empty */
export function DataSeeder(): null {
  const { setCustomers } = useCustomerStore();
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    fetch("/api/customers")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.customers && data.customers.length > 0) {
          setCustomers(data.customers);
        } else {
          setCustomers(SEED_CUSTOMERS);
          await syncCustomersToDb(SEED_CUSTOMERS);
        }
      })
      .catch((err) => console.error("Failed to load customers:", err));
  }, [setCustomers]);

  return null;
}
