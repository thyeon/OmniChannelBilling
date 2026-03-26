"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Customer, ServiceType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface BasicInfoStepProps {
  data: Partial<Customer>;
  editMode: boolean;
  onUpdate: (customer: Partial<Customer>) => void;
  onNext: (createdCustomer: Customer) => void;
  onBack: () => void;
}

const SERVICE_TYPES: ServiceType[] = ["SMS", "EMAIL", "WHATSAPP"];

const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;
const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED", "MAINTENANCE"] as const;

export default function BasicInfoStep({
  data: initialData,
  editMode,
  onUpdate,
  onNext,
  onBack,
}: BasicInfoStepProps) {
  const [formData, setFormData] = useState<Partial<Customer>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(editMode);
  const [fetchError, setFetchError] = useState("");

  // Fetch customer data when editMode is true
  useEffect(() => {
    if (editMode && initialData.id) {
      const fetchCustomer = async () => {
        try {
          const response = await fetch(`/api/customers/${initialData.id}`);
          if (response.ok) {
            const customer = await response.json();
            setFormData(customer);
            onUpdate(customer);
          }
        } catch (error) {
          console.error("Failed to fetch customer:", error);
          setFetchError("Failed to load customer data. Please try again.");
        } finally {
          setIsFetching(false);
        }
      };
      fetchCustomer();
    }
  }, [editMode, initialData.id]);

  // Initialize form data from props
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      ...initialData,
      // Ensure services and rates are initialized
      services: prev.services || initialData.services || [],
      rates: prev.rates || initialData.rates || { SMS: 0, EMAIL: 0, WHATSAPP: 0 },
      status: prev.status || initialData.status || "ACTIVE",
      billingMode: prev.billingMode || initialData.billingMode || "MANUAL",
      consolidateInvoice: prev.consolidateInvoice ?? initialData.consolidateInvoice ?? false,
      discrepancyThreshold: prev.discrepancyThreshold ?? initialData.discrepancyThreshold ?? 1.0,
      billingCycle: prev.billingCycle || initialData.billingCycle || "MONTHLY",
    }));
  }, [initialData]);

  const updateField = <K extends keyof Customer>(field: K, value: Customer[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleServiceToggle = (service: ServiceType) => {
    const currentServices = formData.services || [];
    const newServices = currentServices.includes(service)
      ? currentServices.filter((s) => s !== service)
      : [...currentServices, service];
    updateField("services", newServices);
  };

  const handleRateChange = (service: ServiceType, value: string) => {
    const rate = parseFloat(value) || 0;
    const newRates = { ...formData.rates, [service]: rate };
    updateField("rates", newRates);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Customer name is required";
    }
    if (!formData.autocountCustomerId?.trim()) {
      newErrors.autocountCustomerId = "AutoCount customer ID is required";
    }
    if (!formData.services?.length) {
      newErrors.services = "At least one service must be selected";
    }

    // Validate rates are non-negative
    if (formData.services) {
      formData.services.forEach((service) => {
        const rate = formData.rates?.[service];
        if (rate !== undefined && rate < 0) {
          newErrors[`rate_${service}`] = "Rate must be >= 0";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const url = editMode && formData.id
        ? `/api/customers/${formData.id}`
        : "/api/customers";
      const method = editMode && formData.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save customer");
      }

      const data = await response.json();
      // API returns { customer: {...} } on create/update, unwrap it
      const savedCustomer: Customer = data.customer ?? data;
      onNext(savedCustomer);
    } catch (error) {
      console.error("Failed to save customer:", error);
      setErrors({ submit: error instanceof Error ? error.message : "Failed to save customer" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Customer Basic Information</h2>
        <p className="text-muted-foreground">
          {editMode ? "Edit customer details" : "Enter basic customer details"}
        </p>
      </div>

      {errors.submit && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
          {errors.submit}
        </div>
      )}

      {fetchError && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">{fetchError}</div>
      )}

      <Accordion type="multiple" defaultValue={["core", "autocount", "billing", "schedule"]} className="w-full">
        {/* Section 1: Core Info */}
        <AccordionItem value="core">
          <AccordionTrigger>Core Info</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter customer name"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="autocountCustomerId">AutoCount Customer ID *</Label>
                <Input
                  id="autocountCustomerId"
                  value={formData.autocountCustomerId || ""}
                  onChange={(e) => updateField("autocountCustomerId", e.target.value)}
                  placeholder="Enter AutoCount customer ID"
                />
                {errors.autocountCustomerId && (
                  <p className="text-sm text-destructive">{errors.autocountCustomerId}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Services *</Label>
                <div className="flex flex-wrap gap-4">
                  {SERVICE_TYPES.map((service) => (
                    <div key={service} className="flex items-center gap-2">
                      <Checkbox
                        id={`service-${service}`}
                        checked={formData.services?.includes(service)}
                        onCheckedChange={() => handleServiceToggle(service)}
                      />
                      <Label htmlFor={`service-${service}`} className="font-normal">
                        {service}
                      </Label>
                    </div>
                  ))}
                </div>
                {errors.services && <p className="text-sm text-destructive">{errors.services}</p>}
              </div>

              {formData.services?.length > 0 && (
                <div className="grid gap-2">
                  <Label>Rates</Label>
                  {formData.services.map((service) => (
                    <div key={service} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="font-normal">{service} Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.rates?.[service] ?? 0}
                        onChange={(e) => handleRateChange(service, e.target.value)}
                        className="col-span-2"
                      />
                      {errors[`rate_${service}`] && (
                        <p className="text-sm text-destructive col-span-3">
                          {errors[`rate_${service}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateField("status", value as Customer["status"])}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: AutoCount Configuration */}
        <AccordionItem value="autocount">
          <AccordionTrigger>AutoCount Configuration</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="autocountAccountBookId">Account Book ID</Label>
                <Input
                  id="autocountAccountBookId"
                  value={formData.autocountAccountBookId || ""}
                  onChange={(e) => updateField("autocountAccountBookId", e.target.value)}
                  placeholder="Enter AutoCount account book ID"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="autocountDebtorCode">Debtor Code</Label>
                <Input
                  id="autocountDebtorCode"
                  value={formData.autocountDebtorCode || ""}
                  onChange={(e) => updateField("autocountDebtorCode", e.target.value)}
                  placeholder="Enter debtor code"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="creditTermOverride">Credit Term Override</Label>
                <Input
                  id="creditTermOverride"
                  value={formData.creditTermOverride || ""}
                  onChange={(e) => updateField("creditTermOverride", e.target.value)}
                  placeholder="e.g., Net 30"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="salesLocationOverride">Sales Location Override</Label>
                <Input
                  id="salesLocationOverride"
                  value={formData.salesLocationOverride || ""}
                  onChange={(e) => updateField("salesLocationOverride", e.target.value)}
                  placeholder="Enter sales location"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invoiceDescriptionTemplate">Invoice Description Template</Label>
                <Input
                  id="invoiceDescriptionTemplate"
                  value={formData.invoiceDescriptionTemplate || ""}
                  onChange={(e) => updateField("invoiceDescriptionTemplate", e.target.value)}
                  placeholder="Enter template"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="furtherDescriptionTemplate">Further Description Template</Label>
                <Input
                  id="furtherDescriptionTemplate"
                  value={formData.furtherDescriptionTemplate || ""}
                  onChange={(e) => updateField("furtherDescriptionTemplate", e.target.value)}
                  placeholder="Enter template"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="furtherDescriptionSMSIntl">Further Description (SMS Intl)</Label>
                <Input
                  id="furtherDescriptionSMSIntl"
                  value={formData.furtherDescriptionSMSIntl || ""}
                  onChange={(e) => updateField("furtherDescriptionSMSIntl", e.target.value)}
                  placeholder="Enter description"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Billing Settings */}
        <AccordionItem value="billing">
          <AccordionTrigger>Billing Settings</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="billingMode">Billing Mode</Label>
                <Select
                  value={formData.billingMode}
                  onValueChange={(value) => updateField("billingMode", value as Customer["billingMode"])}
                >
                  <SelectTrigger id="billingMode" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">MANUAL</SelectItem>
                    <SelectItem value="AUTO_PILOT">AUTO_PILOT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="consolidateInvoice">Consolidate Invoice</Label>
                <Switch
                  id="consolidateInvoice"
                  checked={formData.consolidateInvoice}
                  onCheckedChange={(checked) => updateField("consolidateInvoice", checked)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="discrepancyThreshold">Discrepancy Threshold (%)</Label>
                <Input
                  id="discrepancyThreshold"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.discrepancyThreshold ?? 1.0}
                  onChange={(e) => updateField("discrepancyThreshold", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) => updateField("billingCycle", value as Customer["billingCycle"])}
                >
                  <SelectTrigger id="billingCycle">
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>
                        {cycle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.billingCycle === "YEARLY" && (
                <div className="grid gap-2">
                  <Label htmlFor="billingStartMonth">Billing Start Month (1-12)</Label>
                  <Input
                    id="billingStartMonth"
                    type="number"
                    min="1"
                    max="12"
                    value={formData.billingStartMonth ?? ""}
                    onChange={(e) => updateField("billingStartMonth", parseInt(e.target.value) || undefined)}
                    placeholder="Enter month (1-12)"
                  />
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 4: Schedule (shown when AUTO_PILOT) */}
        {formData.billingMode === "AUTO_PILOT" && (
          <AccordionItem value="schedule">
            <AccordionTrigger>Schedule</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dayOfMonth">Day of Month (1-31)</Label>
                  <Input
                    id="dayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.schedule?.dayOfMonth ?? ""}
                    onChange={(e) =>
                      updateField("schedule", {
                        ...formData.schedule,
                        dayOfMonth: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="time">Time (HH:mm)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.schedule?.time || "09:00"}
                    onChange={(e) =>
                      updateField("schedule", {
                        ...formData.schedule,
                        time: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retryIntervalMinutes">Retry Interval (minutes)</Label>
                  <Input
                    id="retryIntervalMinutes"
                    type="number"
                    min="1"
                    value={formData.schedule?.retryIntervalMinutes ?? 30}
                    onChange={(e) =>
                      updateField("schedule", {
                        ...formData.schedule,
                        retryIntervalMinutes: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="0"
                    value={formData.schedule?.maxRetries ?? 3}
                    onChange={(e) =>
                      updateField("schedule", {
                        ...formData.schedule,
                        maxRetries: parseInt(e.target.value) || 3,
                      })
                    }
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editMode ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );
}
