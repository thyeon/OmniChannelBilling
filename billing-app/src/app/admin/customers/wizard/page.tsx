"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, Check, Loader2, Database, Settings, FileText, User } from "lucide-react";

interface CustomerFormData {
  // Basic Info
  name: string;
  email: string;
  contact: string;
  // AutoCount Settings
  autocountAccountBookId: string;
  autocountDebtorCode: string;
  // Default Values
  defaultSmsRate: string;
  defaultEmailRate: string;
  defaultWhatsappRate: string;
  defaultTaxCode: string;
  defaultDescriptionTemplate: string;
}

interface AutoCountAccountBook {
  id: string;
  name: string;
  accountBookId: string;
}

const STEPS = [
  { id: 1, title: "Basic Info", icon: User },
  { id: 2, title: "Data Sources", icon: Database },
  { id: 3, title: "AutoCount", icon: Settings },
  { id: 4, title: "Defaults", icon: FileText },
];

export default function CustomerWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accountBooks, setAccountBooks] = useState<AutoCountAccountBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [formData, setFormData] = useState<CustomerFormData>({
    name: "",
    email: "",
    contact: "",
    autocountAccountBookId: "",
    autocountDebtorCode: "",
    defaultSmsRate: "0.15",
    defaultEmailRate: "0.02",
    defaultWhatsappRate: "0.10",
    defaultTaxCode: "SR",
    defaultDescriptionTemplate: "{{service}} - {{period}}",
  });

  // Fetch account books on mount
  useState(() => {
    async function fetchAccountBooks() {
      try {
        const res = await fetch("/api/autocount/account-books");
        const data = await res.json();
        setAccountBooks(data.accountBooks || []);
      } catch (err) {
        console.error("Failed to fetch account books:", err);
      } finally {
        setLoadingBooks(false);
      }
    }
    fetchAccountBooks();
  });

  const updateFormData = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    setError("");
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError("Customer name is required");
          return false;
        }
        break;
      case 2:
        // DataSourceStep handles its own validation
        break;
      case 3:
        if (!formData.autocountAccountBookId) {
          setError("Please select an AutoCount account book");
          return false;
        }
        if (!formData.autocountDebtorCode.trim()) {
          setError("Debtor code is required");
          return false;
        }
        break;
      case 4:
        // Defaults are optional
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    setError("");

    try {
      // Create customer first
      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          contact: formData.contact,
          autocountAccountBookId: formData.autocountAccountBookId,
          autocountDebtorCode: formData.autocountDebtorCode,
          rates: {
            SMS: parseFloat(formData.defaultSmsRate) || 0,
            EMAIL: parseFloat(formData.defaultEmailRate) || 0,
            WHATSAPP: parseFloat(formData.defaultWhatsappRate) || 0,
          },
          defaultTaxCode: formData.defaultTaxCode,
          defaultDescriptionTemplate: formData.defaultDescriptionTemplate,
        }),
      });

      if (!customerRes.ok) {
        const err = await customerRes.json();
        throw new Error(err.error || "Failed to create customer");
      }

      const customerData = await customerRes.json();
      const customerId = customerData.customer?.id;

      if (!customerId) {
        throw new Error("Failed to get customer ID");
      }

      // Redirect to the customer datasources page for adding data sources
      // (The wizard would need DataSourceStep component for inline editing)
      router.push(`/admin/customers?created=${customerId}`);
    } catch (err) {
      console.error("Failed to create customer:", err);
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return true; // DataSourceStep manages its own state
      case 3:
        return formData.autocountAccountBookId && formData.autocountDebtorCode.trim();
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Customer Setup</h1>
        <p className="text-muted-foreground">
          Configure a new customer with data sources, AutoCount settings, and default values.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "bg-primary text-primary-foreground border-primary"
                      : isActive
                      ? "border-primary text-primary"
                      : "border-muted text-muted"
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 sm:w-24 h-0.5 mx-4 ${
                      isCompleted ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>
            {currentStep === 1 && "Enter the customer's basic information"}
            {currentStep === 2 && "Configure data sources for fetching billable usage data"}
            {currentStep === 3 && "Set up AutoCount integration for this customer"}
            {currentStep === 4 && "Configure default values for invoice generation"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData("name", e.target.value)}
                    placeholder="e.g., Coway (Malaysia) Sdn Bhd"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="billing@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => updateFormData("contact", e.target.value)}
                  placeholder="+60 3 1234 5678"
                />
              </div>
            </div>
          )}

          {/* Step 2: Data Sources */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Data sources can be configured after the customer is created.
                  After completing this wizard, you can add data sources from the customer detail page.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click Next to continue. You will be redirected to configure data sources after customer creation.
              </p>
            </div>
          )}

          {/* Step 3: AutoCount Settings */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autocountAccountBookId">Account Book *</Label>
                {loadingBooks ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading account books...
                  </div>
                ) : accountBooks.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    No account books configured. Please set up AutoCount first.
                  </p>
                ) : (
                  <select
                    id="autocountAccountBookId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.autocountAccountBookId}
                    onChange={(e) => updateFormData("autocountAccountBookId", e.target.value)}
                  >
                    <option value="">Select an account book</option>
                    {accountBooks.map((book) => (
                      <option key={book.id} value={book.accountBookId}>
                        {book.name} ({book.accountBookId})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="autocountDebtorCode">Debtor Code *</Label>
                <Input
                  id="autocountDebtorCode"
                  value={formData.autocountDebtorCode}
                  onChange={(e) => updateFormData("autocountDebtorCode", e.target.value)}
                  placeholder="e.g., COWAY001"
                />
                <p className="text-xs text-muted-foreground">
                  The debtor code in AutoCount Cloud Accounting for this customer.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Defaults */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="defaultSmsRate">SMS Rate (RM)</Label>
                  <Input
                    id="defaultSmsRate"
                    type="number"
                    step="0.01"
                    value={formData.defaultSmsRate}
                    onChange={(e) => updateFormData("defaultSmsRate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultEmailRate">Email Rate (RM)</Label>
                  <Input
                    id="defaultEmailRate"
                    type="number"
                    step="0.01"
                    value={formData.defaultEmailRate}
                    onChange={(e) => updateFormData("defaultEmailRate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultWhatsappRate">WhatsApp Rate (RM)</Label>
                  <Input
                    id="defaultWhatsappRate"
                    type="number"
                    step="0.01"
                    value={formData.defaultWhatsappRate}
                    onChange={(e) => updateFormData("defaultWhatsappRate", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTaxCode">Default Tax Code</Label>
                <Input
                  id="defaultTaxCode"
                  value={formData.defaultTaxCode}
                  onChange={(e) => updateFormData("defaultTaxCode", e.target.value)}
                  placeholder="SR"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultDescriptionTemplate">Invoice Description Template</Label>
                <Input
                  id="defaultDescriptionTemplate"
                  value={formData.defaultDescriptionTemplate}
                  onChange={(e) => updateFormData("defaultDescriptionTemplate", e.target.value)}
                  placeholder="{{service}} - {{period}}"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {'{{service}}'}, {'{{period}}'}, {'{{customer}}'}, {'{{qty}}'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Customer
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
