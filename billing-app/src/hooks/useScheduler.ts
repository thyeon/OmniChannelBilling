"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCustomerStore } from "@/store/useCustomerStore";
import { useScheduleStore } from "@/store/useScheduleStore";
import {
  Customer,
  ScheduledJob,
  InvoiceHistory,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types";
import { checkDiscrepancy } from "@/domain/discrepancy";

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateInvoiceId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/** Compute the next scheduled datetime for a customer based on their schedule config */
function computeNextScheduledAt(customer: Customer): string | null {
  if (customer.billingMode !== "AUTO_PILOT" || !customer.schedule) return null;

  const now = new Date();
  const { dayOfMonth, time } = customer.schedule;
  const [hours, minutes] = time.split(":").map(Number);

  // Try this month first
  const thisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    dayOfMonth,
    hours,
    minutes,
    0,
    0
  );

  if (thisMonth > now) {
    return thisMonth.toISOString();
  }

  // Otherwise next month
  const nextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    dayOfMonth,
    hours,
    minutes,
    0,
    0
  );
  return nextMonth.toISOString();
}

/** Get the billing month (previous calendar month) for a given scheduled date */
function getBillingMonth(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const year = prevMonth.getFullYear();
  const month = String(prevMonth.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Simulate fetching usage data and generating an invoice for a customer */
function simulateInvoiceGeneration(customer: Customer, billingMonth: string): {
  success: boolean;
  invoice?: InvoiceHistory;
  error?: string;
} {
  // Simulate connection statuses
  const lineItems: InvoiceLineItem[] = customer.services.map((service) => {
    const hasProvider = customer.providers.some((p) => p.type === service);
    const reconServer = customer.reconServers.find((r) => r.type === service);
    const provider = customer.providers.find((p) => p.type === service);

    // ~90% recon success, ~85% provider success
    const reconSuccess = Math.random() > 0.1;
    const providerSuccess = hasProvider ? Math.random() > 0.15 : false;

    const reconTotal = reconSuccess
      ? Math.floor(Math.random() * 10000) + 500
      : 0;
    const reconSent = reconTotal;
    const reconFailed = reconSuccess ? Math.floor(Math.random() * 100) : 0;
    const reconWithheld = reconSuccess ? Math.floor(Math.random() * 50) : 0;

    let providerTotal = 0;
    let discrepancyPercentage = 0;
    let isMismatch = false;

    if (hasProvider && providerSuccess && reconSuccess) {
      providerTotal = reconTotal + Math.floor(Math.random() * 300) - 100;
      const result = checkDiscrepancy(
        reconTotal,
        providerTotal,
        customer.discrepancyThreshold
      );
      discrepancyPercentage = result.diffPercentage;
      isMismatch = result.isMismatch;
    } else if (hasProvider && providerSuccess && !reconSuccess) {
      providerTotal = Math.floor(Math.random() * 10000) + 500;
    }

    // Determine billable count
    let billableCount: number;
    let wasOverridden = false;
    let overrideReason: string | undefined;

    if (!reconSuccess && providerSuccess) {
      billableCount = providerTotal;
      wasOverridden = true;
      overrideReason = "Recon server failed — used provider count";
    } else if (reconSuccess && hasProvider && !providerSuccess) {
      billableCount = reconTotal;
      wasOverridden = true;
      overrideReason = "Provider connection failed — used recon count";
    } else if (!hasProvider) {
      billableCount = reconTotal;
    } else if (isMismatch) {
      billableCount = reconTotal;
    } else {
      billableCount = providerTotal || reconTotal;
    }

    const rate = customer.rates[service];

    return {
      service,
      hasProvider,
      reconServerStatus: reconSuccess ? "SUCCESS" : "FAILED",
      providerStatus: !hasProvider
        ? "NOT_CONFIGURED"
        : providerSuccess
        ? "SUCCESS"
        : "FAILED",
      reconServerName: reconServer?.name ?? "Unknown",
      providerName: provider?.name ?? "",
      reconTotal,
      reconDetails: { sent: reconSent, failed: reconFailed, withheld: reconWithheld },
      providerTotal,
      discrepancyPercentage,
      isMismatch,
      thresholdUsed: customer.discrepancyThreshold,
      billableCount,
      wasOverridden,
      overrideReason,
      rate,
      totalCharge: billableCount * rate,
    } as InvoiceLineItem;
  });

  const totalAmount = lineItems.reduce((sum, li) => sum + li.totalCharge, 0);

  // Simulate AutoCount sync (~80% success)
  const syncSuccess = Math.random() > 0.2;

  const invoice: InvoiceHistory = {
    id: generateInvoiceId(),
    customerId: customer.id,
    customerName: customer.name,
    billingMonth,
    totalAmount,
    status: syncSuccess ? ("SYNCED" as InvoiceStatus) : ("ERROR" as InvoiceStatus),
    autocountRefId: syncSuccess ? `AC-${Date.now()}` : undefined,
    createdAt: new Date().toISOString(),
    billingMode: customer.billingMode,
    schedule: customer.schedule,
    lineItems,
    generatedBy: "SCHEDULED",
    syncError: syncSuccess
      ? undefined
      : "AutoCount API sync failed — connection timeout",
  };

  if (!syncSuccess) {
    return { success: false, invoice, error: "AutoCount API sync failed — connection timeout" };
  }

  return { success: true, invoice };
}

/**
 * Hook that runs the simulated scheduling engine.
 * - Computes upcoming jobs from AUTO_PILOT customers
 * - Checks every 60s if any job should fire
 * - Handles retries on failure
 */
export function useScheduler(): void {
  const customers = useCustomerStore((s) => s.customers);
  const hasInitialized = useRef(false);

  // Seed upcoming jobs from AUTO_PILOT customers (once)
  useEffect(() => {
    if (hasInitialized.current || customers.length === 0) return;
    hasInitialized.current = true;

    const autoPilotCustomers = customers.filter(
      (c) => c.billingMode === "AUTO_PILOT" && c.schedule
    );

    // Seed mock completed/failed jobs for demo purposes
    const mockPastJobs: ScheduledJob[] = [
      {
        id: "job-past-001",
        customerId: "cust-002",
        customerName: "Beta Industries",
        billingMonth: "2023-12",
        scheduledAt: "2024-01-15T09:00:00Z",
        status: "COMPLETED",
        retryCount: 0,
        maxRetries: 3,
        retryIntervalMinutes: 30,
        invoiceId: "inv-002",
        completedAt: "2024-01-15T09:00:12Z",
      },
      {
        id: "job-past-002",
        customerId: "cust-002",
        customerName: "Beta Industries",
        billingMonth: "2023-11",
        scheduledAt: "2023-12-15T09:00:00Z",
        status: "COMPLETED",
        retryCount: 0,
        maxRetries: 3,
        retryIntervalMinutes: 30,
        invoiceId: "inv-005",
        completedAt: "2023-12-15T09:00:08Z",
      },
      {
        id: "job-past-003",
        customerId: "cust-002",
        customerName: "Beta Industries",
        billingMonth: "2023-10",
        scheduledAt: "2023-11-15T09:00:00Z",
        status: "FAILED",
        retryCount: 3,
        maxRetries: 3,
        retryIntervalMinutes: 30,
        error: "AutoCount API unreachable after 3 retries",
      },
    ];

    // Compute upcoming PENDING jobs
    const upcomingJobs: ScheduledJob[] = autoPilotCustomers
      .map((customer) => {
        const scheduledAt = computeNextScheduledAt(customer);
        if (!scheduledAt) return null;
        return {
          id: generateJobId(),
          customerId: customer.id,
          customerName: customer.name,
          billingMonth: getBillingMonth(scheduledAt),
          scheduledAt,
          status: "PENDING" as const,
          retryCount: 0,
          maxRetries: customer.schedule!.maxRetries,
          retryIntervalMinutes: customer.schedule!.retryIntervalMinutes,
        };
      })
      .filter(Boolean) as ScheduledJob[];

    const allJobs = [...mockPastJobs, ...upcomingJobs];
    useScheduleStore.getState().setJobs(allJobs);
  }, [customers]);

  // Ticker: check every 60s if any PENDING or RETRYING job should fire
  const runSchedulerTick = useCallback(() => {
    const now = new Date();
    const { jobs: currentJobs, updateJob } = useScheduleStore.getState();
    const currentCustomers = useCustomerStore.getState().customers;

    for (const job of currentJobs) {
      if (job.status === "PENDING" && new Date(job.scheduledAt) <= now) {
        // Fire the job
        const customer = currentCustomers.find((c) => c.id === job.customerId);
        if (!customer) {
          updateJob(job.id, { status: "FAILED", error: "Customer not found" });
          continue;
        }

        updateJob(job.id, { status: "RUNNING" });

        const result = simulateInvoiceGeneration(customer, job.billingMonth);

        if (result.success && result.invoice) {
          // Save invoice via API
          fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.invoice),
          }).catch((err) => console.error("Failed to save invoice:", err));
          updateJob(job.id, {
            status: "COMPLETED",
            invoiceId: result.invoice.id,
            completedAt: new Date().toISOString(),
          });
        } else {
          if (job.retryCount + 1 < job.maxRetries) {
            const nextRetry = new Date(
              now.getTime() + job.retryIntervalMinutes * 60 * 1000
            );
            updateJob(job.id, {
              status: "RETRYING",
              retryCount: job.retryCount + 1,
              nextRetryAt: nextRetry.toISOString(),
              error: result.error,
              invoiceId: result.invoice?.id,
            });
            // Save error invoice via API
            if (result.invoice) {
              fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(result.invoice),
              }).catch((err) => console.error("Failed to save invoice:", err));
            }
          } else {
            updateJob(job.id, {
              status: "FAILED",
              retryCount: job.retryCount + 1,
              error: result.error,
            });
            if (result.invoice) {
              fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(result.invoice),
              }).catch((err) => console.error("Failed to save invoice:", err));
            }
          }
        }
      }

      if (job.status === "RETRYING" && job.nextRetryAt && new Date(job.nextRetryAt) <= now) {
        const customer = currentCustomers.find((c) => c.id === job.customerId);
        if (!customer) {
          updateJob(job.id, { status: "FAILED", error: "Customer not found" });
          continue;
        }

        updateJob(job.id, { status: "RUNNING" });

        const result = simulateInvoiceGeneration(customer, job.billingMonth);

        if (result.success && result.invoice) {
          fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.invoice),
          }).catch((err) => console.error("Failed to save invoice:", err));
          updateJob(job.id, {
            status: "COMPLETED",
            invoiceId: result.invoice.id,
            completedAt: new Date().toISOString(),
            error: undefined,
            nextRetryAt: undefined,
          });
        } else {
          if (job.retryCount + 1 < job.maxRetries) {
            const nextRetry = new Date(
              now.getTime() + job.retryIntervalMinutes * 60 * 1000
            );
            updateJob(job.id, {
              status: "RETRYING",
              retryCount: job.retryCount + 1,
              nextRetryAt: nextRetry.toISOString(),
              error: result.error,
            });
          } else {
            updateJob(job.id, {
              status: "FAILED",
              retryCount: job.retryCount + 1,
              error: result.error,
              nextRetryAt: undefined,
            });
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(runSchedulerTick, 60_000);
    return () => clearInterval(interval);
  }, [runSchedulerTick]);
}
