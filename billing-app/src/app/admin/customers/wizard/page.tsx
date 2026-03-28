"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import BasicInfoStep from "./BasicInfoStep";
import DataSourceStep from "./DataSourceStep";
import ProductMappingStep from "./ProductMappingStep";
import { Customer } from "@/types";
import { CustomerProductMapping } from "@/domain/models/customerProductMapping";

interface WizardData {
  // Basic info step
  customer?: Partial<Customer>;
  // DataSource step
  dataSourceId?: string;
  // Product mapping step
  productMappings: CustomerProductMapping[];
}

type WizardStep = "info" | "dataSource" | "productMapping" | "review";

interface WizardStepConfig {
  id: WizardStep;
  title: string;
}

const STEPS: WizardStepConfig[] = [
  { id: "info", title: "Basic Info" },
  { id: "dataSource", title: "Data Source" },
  { id: "productMapping", title: "Product Mapping" },
  { id: "review", title: "Review" },
];

export default function CustomerWizardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerIdParam = searchParams.get("customerId") || searchParams.get("id");
  const isEditMode = !!customerIdParam;
  const [currentStep, setCurrentStep] = useState<WizardStep>("info");
  const [data, setData] = useState<WizardData>({
    // In edit mode, pass the customerIdParam as id so BasicInfoStep can fetch the customer
    customer: customerIdParam ? { id: customerIdParam } as Customer : undefined,
    productMappings: [],
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  function handleNext(): void {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }

  function handleBack(): void {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }

  function handleUpdateMappings(mappings: CustomerProductMapping[]): void {
    setData((prev) => ({ ...prev, productMappings: mappings }));
  }

  async function handleSubmit(): Promise<void> {
    if (!data.customer?.id) {
      alert("No customer found. Please complete the Basic Info step.");
      return;
    }
    // Data sources already saved during DataSourceStep (immediate POST/PUT on save)
    // Product mappings already saved during ProductMappingStep (immediate POST/PUT on save)
    // In edit mode, we need to update the customer as well
    if (isEditMode) {
      try {
        const response = await fetch(`/api/customers/${data.customer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.customer),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update customer");
        }
      } catch (error) {
        console.error("Failed to update customer:", error);
        alert(error instanceof Error ? error.message : "Failed to update customer");
        return;
      }
    }
    console.log(isEditMode ? "Customer update complete:" : "Customer creation complete:", data.customer);
    router.push("/admin/customers");
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index <= currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <ChevronRight className="mx-4 h-4 w-4 text-muted" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="border rounded-lg p-6">
        {currentStep === "info" && (
          <BasicInfoStep
            data={data.customer || {}}
            editMode={!!customerIdParam}
            onUpdate={(c) => setData((p) => ({ ...p, customer: c }))}
            onNext={(c) => {
              setData((p) => ({ ...p, customer: c }));
              handleNext();
            }}
            onBack={handleBack}
          />
        )}

        {currentStep === "dataSource" && (
          <DataSourceStep customerId={data.customer?.id || ""} onNext={handleNext} onBack={handleBack} />
        )}

        {currentStep === "productMapping" && (
          <ProductMappingStep
            customerId={data.customer?.id || ""}
            data={data.productMappings}
            onUpdate={handleUpdateMappings}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === "review" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review & Submit</h2>
            <p className="text-muted-foreground">
              {isEditMode ? "Updating" : "Creating"} customer &quot;{data.customer?.name}&quot; with {data.dataSourceId ? "1" : "0"} data source(s) and {data.productMappings.length} product mapping(s).
            </p>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 border rounded-md"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                {isEditMode ? "Update Customer" : "Create Customer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}