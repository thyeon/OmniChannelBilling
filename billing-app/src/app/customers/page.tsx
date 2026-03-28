"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCustomerStore } from "@/store/useCustomerStore";
import { Customer, ServiceType, ServiceProvider, ReconServer } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const ALL_SERVICES: ServiceType[] = ["SMS", "EMAIL", "WHATSAPP"];

interface AccountBookOption {
  id: string;
  name: string;
  accountBookId: string;
}

function generateId(): string {
  // Browser-compatible UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createEmptyCustomer(): Customer {
  return {
    id: generateId(),
    name: "",
    autocountCustomerId: "",
    services: [],
    providers: [],
    reconServers: [],
    rates: { SMS: 0, EMAIL: 0, WHATSAPP: 0 },
    billingMode: "MANUAL",
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    schedule: undefined,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
  };
}

export default function CustomersPage(): React.ReactElement {
  const {
    customers,
    setCustomers,
    addCustomer,
    updateCustomer,
    removeCustomer,
    setSelectedCustomer,
  } = useCustomerStore();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Customer>(createEmptyCustomer());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [accountBooks, setAccountBooks] = useState<AccountBookOption[]>([]);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (data.customers) {
          setCustomers(data.customers);
        }
      })
      .catch((err) => console.error("Failed to fetch customers:", err));

    fetch("/api/autocount/account-books")
      .then((res) => res.json())
      .then((data) => setAccountBooks(data.accountBooks || []))
      .catch((err) => console.error("Failed to fetch account books:", err));
  }, [setCustomers]);

  function openAddSheet(): void {
    const newCustomer = createEmptyCustomer();
    setEditingCustomer(null);
    setFormData(newCustomer);
    setValidationErrors({});
    setIsSheetOpen(true);
  }

  function openEditSheet(customer: Customer): void {
    setEditingCustomer(customer);
    setFormData({ ...customer });
    setValidationErrors({});
    setSelectedCustomer(customer);
    setIsSheetOpen(true);
  }

  function handleDeleteCustomer(id: string): void {
    removeCustomer(id);
    fetch(`/api/customers/${id}`, { method: "DELETE" }).catch((err) =>
      console.error("Failed to sync customer delete to DB:", err)
    );
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Customer name is required";
    }
    if (!formData.autocountCustomerId.trim()) {
      errors.autocountCustomerId = "AutoCount Customer ID is required";
    }
    if (formData.discrepancyThreshold < 0) {
      errors.discrepancyThreshold = "Threshold must be a positive number";
    }
    if (formData.services.length === 0) {
      errors.services = "At least one service must be selected";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(): Promise<void> {
    if (!validateForm()) return;

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
      fetch(`/api/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }).catch((err) => console.error("Failed to sync customer update to DB:", err));
    } else {
      addCustomer(formData);
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }).catch((err) => console.error("Failed to sync new customer to DB:", err));
    }

    setIsSheetOpen(false);
    setSelectedCustomer(null);
  }

  function handleServiceToggle(service: ServiceType, checked: boolean): void {
    const updatedServices = checked
      ? [...formData.services, service]
      : formData.services.filter((s) => s !== service);

    // Remove providers and recon servers for unchecked services
    const updatedProviders = formData.providers.filter((p) =>
      updatedServices.includes(p.type)
    );
    const updatedReconServers = formData.reconServers.filter((r) =>
      updatedServices.includes(r.type)
    );

    setFormData({
      ...formData,
      services: updatedServices,
      providers: updatedProviders,
      reconServers: updatedReconServers,
    });
  }

  function handleProviderToggle(service: ServiceType, enabled: boolean): void {
    if (enabled) {
      // Add empty provider entry for this service
      const alreadyExists = formData.providers.some((p) => p.type === service);
      if (!alreadyExists) {
        setFormData({
          ...formData,
          providers: [
            ...formData.providers,
            { id: generateId(), name: "", type: service, apiKey: "", apiEndpoint: "" },
          ],
        });
      }
    } else {
      // Remove provider entry for this service
      setFormData({
        ...formData,
        providers: formData.providers.filter((p) => p.type !== service),
      });
    }
  }

  function handleProviderChange(
    serviceType: ServiceType,
    field: keyof Pick<ServiceProvider, "name" | "apiKey" | "apiEndpoint">,
    value: string
  ): void {
    const existingIndex = formData.providers.findIndex(
      (p) => p.type === serviceType
    );

    let updatedProviders: ServiceProvider[];
    if (existingIndex >= 0) {
      updatedProviders = formData.providers.map((p, i) =>
        i === existingIndex ? { ...p, [field]: value } : p
      );
    } else {
      updatedProviders = [
        ...formData.providers,
        {
          id: generateId(),
          name: "",
          type: serviceType,
          apiKey: "",
          apiEndpoint: "",
          [field]: value,
        },
      ];
    }

    setFormData({ ...formData, providers: updatedProviders });
  }

  function getProviderForService(serviceType: ServiceType): ServiceProvider | undefined {
    return formData.providers.find((p) => p.type === serviceType);
  }

  function handleReconServerChange(
    serviceType: ServiceType,
    field: keyof Pick<ReconServer, "name" | "userId" | "apiKey" | "apiEndpoint">,
    value: string
  ): void {
    const existingIndex = formData.reconServers.findIndex(
      (r) => r.type === serviceType
    );

    let updatedReconServers: ReconServer[];
    if (existingIndex >= 0) {
      updatedReconServers = formData.reconServers.map((r, i) =>
        i === existingIndex ? { ...r, [field]: value } : r
      );
    } else {
      updatedReconServers = [
        ...formData.reconServers,
        {
          id: generateId(),
          name: "",
          type: serviceType,
          userId: "",
          apiKey: "",
          apiEndpoint: "",
          [field]: value,
        },
      ];
    }

    setFormData({ ...formData, reconServers: updatedReconServers });
  }

  function getReconServerForService(serviceType: ServiceType): ReconServer | undefined {
    return formData.reconServers.find((r) => r.type === serviceType);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Customer Management
        </h1>
        <Button onClick={openAddSheet}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>AutoCount ID</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Billing Mode</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No customers found. Click &quot;Add Customer&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {customer.autocountCustomerId}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {customer.services.map((service) => (
                        <Badge key={service} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={customer.billingMode === "AUTO_PILOT" ? "default" : "outline"}
                    >
                      {customer.billingMode === "AUTO_PILOT" ? "Auto Pilot" : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.discrepancyThreshold}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditSheet(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCustomer(customer.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </SheetTitle>
            <SheetDescription>
              {editingCustomer
                ? "Update customer details below."
                : "Fill in the details to add a new customer."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* General Info */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                General Info
              </h3>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter customer name"
                />
                {validationErrors.name && (
                  <p className="text-sm text-destructive">{validationErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="autocountId">AutoCount Customer ID *</Label>
                <Input
                  id="autocountId"
                  value={formData.autocountCustomerId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      autocountCustomerId: e.target.value,
                    })
                  }
                  placeholder="Enter AutoCount Customer ID"
                />
                {validationErrors.autocountCustomerId && (
                  <p className="text-sm text-destructive">
                    {validationErrors.autocountCustomerId}
                  </p>
                )}
              </div>
            </section>

            <Separator />

            {/* Services */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Services
              </h3>
              <div className="space-y-3">
                {ALL_SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service}`}
                      checked={formData.services.includes(service)}
                      onCheckedChange={(checked) =>
                        handleServiceToggle(service, checked === true)
                      }
                    />
                    <Label htmlFor={`service-${service}`}>{service}</Label>
                  </div>
                ))}
              </div>
              {validationErrors.services && (
                <p className="text-sm text-destructive">{validationErrors.services}</p>
              )}
            </section>

            <Separator />

            {/* Providers - Dynamic based on selected services */}
            {formData.services.length > 0 && (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Provider Configuration
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Service Provider is optional. When disabled, billing uses Reconciliation Server counts only.
                  </p>
                  {formData.services.map((service) => {
                    const provider = getProviderForService(service);
                    const isEnabled = !!provider;
                    return (
                      <div key={service} className="space-y-3 rounded-md border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{service} Provider</h4>
                          <Switch
                            id={`provider-toggle-${service}`}
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              handleProviderToggle(service, checked)
                            }
                          />
                        </div>
                        {isEnabled ? (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor={`provider-name-${service}`}>
                                Provider Name
                              </Label>
                              <Input
                                id={`provider-name-${service}`}
                                value={provider?.name ?? ""}
                                onChange={(e) =>
                                  handleProviderChange(service, "name", e.target.value)
                                }
                                placeholder="e.g. Twilio, SendGrid"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`provider-key-${service}`}>API Key</Label>
                              <Input
                                id={`provider-key-${service}`}
                                type="password"
                                value={provider?.apiKey ?? ""}
                                onChange={(e) =>
                                  handleProviderChange(service, "apiKey", e.target.value)
                                }
                                placeholder="Enter API Key"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`provider-endpoint-${service}`}>
                                API Endpoint
                              </Label>
                              <Input
                                id={`provider-endpoint-${service}`}
                                value={provider?.apiEndpoint ?? ""}
                                onChange={(e) =>
                                  handleProviderChange(
                                    service,
                                    "apiEndpoint",
                                    e.target.value
                                  )
                                }
                                placeholder="https://api.example.com/v1"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Not configured — billing will use Reconciliation Server count only.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </section>
                <Separator />

                {/* Reconciliation Server - Dynamic based on selected services */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Reconciliation Server Configuration
                  </h3>
                  {formData.services.map((service) => {
                    const reconServer = getReconServerForService(service);
                    return (
                      <div key={service} className="space-y-3 rounded-md border p-4">
                        <h4 className="text-sm font-medium">{service} Recon Server</h4>
                        <div className="space-y-2">
                          <Label htmlFor={`recon-name-${service}`}>
                            Server Name
                          </Label>
                          <Input
                            id={`recon-name-${service}`}
                            value={reconServer?.name ?? ""}
                            onChange={(e) =>
                              handleReconServerChange(service, "name", e.target.value)
                            }
                            placeholder="e.g. Internal Recon, AWS Recon"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`recon-userId-${service}`}>
                            User ID
                          </Label>
                          <Input
                            id={`recon-userId-${service}`}
                            value={reconServer?.userId ?? ""}
                            onChange={(e) =>
                              handleReconServerChange(service, "userId", e.target.value)
                            }
                            placeholder="e.g. gi_xHdw6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`recon-key-${service}`}>API Key</Label>
                          <Input
                            id={`recon-key-${service}`}
                            type="password"
                            value={reconServer?.apiKey ?? ""}
                            onChange={(e) =>
                              handleReconServerChange(service, "apiKey", e.target.value)
                            }
                            placeholder="Enter API Key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`recon-endpoint-${service}`}>
                            API Endpoint
                          </Label>
                          <Input
                            id={`recon-endpoint-${service}`}
                            value={reconServer?.apiEndpoint ?? ""}
                            onChange={(e) =>
                              handleReconServerChange(
                                service,
                                "apiEndpoint",
                                e.target.value
                              )
                            }
                            placeholder="https://recon.example.com/v1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </section>
                <Separator />
              </>
            )}

            {/* Rates & Thresholds */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Rates & Thresholds
              </h3>
              {formData.services.includes("SMS") && (
                <div className="space-y-2">
                  <Label htmlFor="rateSms">SMS Rate (per unit)</Label>
                  <Input
                    id="rateSms"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rates.SMS}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rates: { ...formData.rates, SMS: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
              )}
              {formData.services.includes("EMAIL") && (
                <div className="space-y-2">
                  <Label htmlFor="rateEmail">Email Rate (per unit)</Label>
                  <Input
                    id="rateEmail"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rates.EMAIL}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rates: {
                          ...formData.rates,
                          EMAIL: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              )}
              {formData.services.includes("WHATSAPP") && (
                <div className="space-y-2">
                  <Label htmlFor="rateWhatsapp">WhatsApp Rate (per unit)</Label>
                  <Input
                    id="rateWhatsapp"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rates.WHATSAPP}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rates: {
                          ...formData.rates,
                          WHATSAPP: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="threshold">Discrepancy Threshold *</Label>
                <div className="relative">
                  <Input
                    id="threshold"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discrepancyThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discrepancyThreshold: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                {validationErrors.discrepancyThreshold && (
                  <p className="text-sm text-destructive">
                    {validationErrors.discrepancyThreshold}
                  </p>
                )}
              </div>
            </section>

            <Separator />

            {/* AutoCount Configuration */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  AutoCount Configuration
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableAutocount">Enable AutoCount Billing</Label>
                  <Switch
                    id="enableAutocount"
                    checked={formData.autocountAccountBookId !== undefined}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          autocountAccountBookId: "",
                        });
                      } else {
                        setFormData({
                          ...formData,
                          autocountAccountBookId: undefined,
                          autocountDebtorCode: undefined,
                          creditTermOverride: undefined,
                          salesLocationOverride: undefined,
                          serviceProductOverrides: undefined,
                        });
                      }
                    }}
                  />
                </div>

                {formData.autocountAccountBookId !== undefined && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="autocountAccountBook">Account Book *</Label>
                      <select
                        id="autocountAccountBook"
                        className="w-full p-2 border rounded-md"
                        value={formData.autocountAccountBookId || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            autocountAccountBookId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Select an account book</option>
                        {accountBooks.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.name} ({book.accountBookId})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="autocountDebtorCode">Debtor Code *</Label>
                      <Input
                        id="autocountDebtorCode"
                        value={formData.autocountDebtorCode || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            autocountDebtorCode: e.target.value || undefined,
                          })
                        }
                        placeholder="e.g. 300-C001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditTermOverride">Credit Term Override (Optional)</Label>
                      <Input
                        id="creditTermOverride"
                        value={formData.creditTermOverride || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            creditTermOverride: e.target.value || undefined,
                          })
                        }
                        placeholder="e.g. Net 30 days (leaves blank for default)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="salesLocationOverride">Sales Location Override (Optional)</Label>
                      <Input
                        id="salesLocationOverride"
                        value={formData.salesLocationOverride || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            salesLocationOverride: e.target.value || undefined,
                          })
                        }
                        placeholder="e.g. HQ (leaves blank for default)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Product Code Overrides (Optional)</Label>
                      <p className="text-xs text-muted-foreground">
                        Override product codes for specific services. Leave blank to use account book defaults.
                      </p>
                      {formData.services.map((service) => {
                        const override = formData.serviceProductOverrides?.find(
                          (o) => o.serviceType === service
                        );
                        return (
                          <div key={service} className="flex items-center gap-2">
                            <Label htmlFor={`product-override-${service}`} className="w-20">
                              {service}
                            </Label>
                            <Input
                              id={`product-override-${service}`}
                              className="flex-1"
                              value={override?.productCode || ""}
                              onChange={(e) => {
                                const overrides = formData.serviceProductOverrides || [];
                                const existingIndex = overrides.findIndex(
                                  (o) => o.serviceType === service
                                );
                                let updatedOverrides;
                                if (existingIndex >= 0) {
                                  if (e.target.value) {
                                    updatedOverrides = overrides.map((o, i) =>
                                      i === existingIndex
                                        ? { ...o, productCode: e.target.value }
                                        : o
                                    );
                                  } else {
                                    updatedOverrides = overrides.filter(
                                      (o) => o.serviceType !== service
                                    );
                                  }
                                } else if (e.target.value) {
                                  updatedOverrides = [
                                    ...overrides,
                                    { serviceType: service, productCode: e.target.value },
                                  ];
                                } else {
                                  updatedOverrides = overrides;
                                }
                                setFormData({
                                  ...formData,
                                  serviceProductOverrides:
                                    updatedOverrides.length > 0 ? updatedOverrides : undefined,
                                });
                              }}
                              placeholder="e.g. SMS-Enhanced"
                            />
                            <select
                              className="p-2 border rounded-md text-sm"
                              value={override?.billingMode || ""}
                              onChange={(e) => {
                                const overrides = formData.serviceProductOverrides || [];
                                const existingIndex = overrides.findIndex(
                                  (o) => o.serviceType === service
                                );
                                const newMode = e.target.value as "ITEMIZED" | "LUMP_SUM" | "";
                                let updatedOverrides;
                                if (existingIndex >= 0) {
                                  updatedOverrides = overrides.map((o, i) =>
                                    i === existingIndex
                                      ? { ...o, billingMode: newMode || undefined }
                                      : o
                                  );
                                } else {
                                  updatedOverrides = overrides;
                                }
                                setFormData({
                                  ...formData,
                                  serviceProductOverrides:
                                    updatedOverrides.length > 0 ? updatedOverrides : undefined,
                                });
                              }}
                            >
                              <option value="">Default</option>
                              <option value="LUMP_SUM">Lump Sum</option>
                              <option value="ITEMIZED">Itemized</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoiceDescOverride">Invoice Description Template Override</Label>
                      <Input
                        id="invoiceDescOverride"
                        value={formData.invoiceDescriptionTemplate || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoiceDescriptionTemplate: e.target.value || undefined,
                          })
                        }
                        placeholder="Leave blank to use account book default"
                      />
                      <p className="text-xs text-muted-foreground">
                        Placeholders: {"{BillingCycle}"}, {"{CustomerName}"}, {"{TotalAmount}"}, {"{SMSCount}"}, {"{SMSRate}"}, {"{SMSTotal}"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="furtherDescOverride">Further Description Template Override</Label>
                      <Input
                        id="furtherDescOverride"
                        value={formData.furtherDescriptionTemplate || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            furtherDescriptionTemplate: e.target.value || undefined,
                          })
                        }
                        placeholder="Leave blank to use account book default"
                      />
                      <p className="text-xs text-muted-foreground">
                        Applied to each invoice line item. Same placeholders as above.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            <Separator />

            {/* Billing Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Billing Settings
              </h3>
              <div className="flex items-center justify-between">
                <Label htmlFor="consolidate">Consolidate Invoice</Label>
                <Switch
                  id="consolidate"
                  checked={formData.consolidateInvoice}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, consolidateInvoice: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="billingMode">Auto Pilot Mode</Label>
                <Switch
                  id="billingMode"
                  checked={formData.billingMode === "AUTO_PILOT"}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      billingMode: checked ? "AUTO_PILOT" : "MANUAL",
                      schedule: checked
                        ? formData.schedule ?? { dayOfMonth: 1, time: "00:00", retryIntervalMinutes: 30, maxRetries: 3 }
                        : undefined,
                    })
                  }
                />
              </div>
              {formData.billingMode === "AUTO_PILOT" && formData.schedule && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduleDay">Day of Month (1-31)</Label>
                      <Input
                        id="scheduleDay"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.schedule.dayOfMonth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, dayOfMonth: parseInt(e.target.value, 10) || 1 },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduleTime">Time (24h)</Label>
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={formData.schedule.time}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, time: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Retry Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="retryInterval">Retry Interval (min)</Label>
                      <Input
                        id="retryInterval"
                        type="number"
                        min="1"
                        value={formData.schedule.retryIntervalMinutes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, retryIntervalMinutes: parseInt(e.target.value, 10) || 30 },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxRetries">Max Retries</Label>
                      <Input
                        id="maxRetries"
                        type="number"
                        min="1"
                        max="10"
                        value={formData.schedule.maxRetries}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            schedule: { ...formData.schedule!, maxRetries: parseInt(e.target.value, 10) || 3 },
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invoice will be generated on day {formData.schedule.dayOfMonth} at {formData.schedule.time} for the previous calendar month&apos;s usage data.
                  </p>
                </div>
              )}
            </section>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingCustomer ? "Update Customer" : "Add Customer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
