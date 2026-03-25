"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import ProductMappingStep from "./ProductMappingStep";
import { CustomerProductMapping } from "@/domain/models/customerProductMapping";

interface WizardData {
  // Basic info step
  customerName: string;
  customerId: string;
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
  const [currentStep, setCurrentStep] = useState<WizardStep>("info");
  const [data, setData] = useState<WizardData>({
    customerName: "",
    customerId: "",
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

  function handleSubmit(): void {
    console.log("Submitting customer data:", data);
    // TODO: Implement API call to create customer
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
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Customer Basic Information</h2>
            <p className="text-muted-foreground">Enter basic customer details</p>
            {/* Placeholder for basic info form */}
            <div className="text-center py-8 text-muted-foreground">
              Basic Info step - not implemented in this task
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentStep === "dataSource" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Data Source Configuration</h2>
            <p className="text-muted-foreground">Configure data source for this customer</p>
            {/* Placeholder for DataSourceStep - Task 3.x */}
            <div className="text-center py-8 text-muted-foreground">
              DataSource step - not implemented in this task (Task 3.x)
            </div>
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
                onClick={handleNext}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentStep === "productMapping" && (
          <ProductMappingStep
            customerId={data.customerId || "new-customer"}
            data={data.productMappings}
            onUpdate={handleUpdateMappings}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === "review" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review & Submit</h2>
            <p className="text-muted-foreground">Review your configuration before submitting</p>
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
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}