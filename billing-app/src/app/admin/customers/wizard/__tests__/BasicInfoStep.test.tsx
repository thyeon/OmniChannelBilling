import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BasicInfoStep from "../BasicInfoStep";
import { Customer } from "@/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("BasicInfoStep", () => {
  const mockOnUpdate = vi.fn();
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<{
    data: Partial<Customer>;
    editMode: boolean;
    onUpdate: typeof mockOnUpdate;
    onNext: typeof mockOnNext;
    onBack: typeof mockOnBack;
  }> = {}) => {
    return render(
      <BasicInfoStep
        data={props.data || {}}
        editMode={props.editMode || false}
        onUpdate={props.onUpdate || mockOnUpdate}
        onNext={props.onNext || mockOnNext}
        onBack={props.onBack || mockOnBack}
      />
    );
  };

  it("renders all 4 accordion sections", () => {
    renderComponent();

    expect(screen.getByText("Core Info")).toBeInTheDocument();
    expect(screen.getByText("AutoCount Configuration")).toBeInTheDocument();
    expect(screen.getByText("Billing Settings")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("renders form fields in Core Info section", () => {
    renderComponent();

    expect(screen.getByLabelText("Customer Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("AutoCount Customer ID *")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("renders AutoCount Configuration fields", () => {
    renderComponent();

    expect(screen.getByLabelText("Account Book ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Debtor Code")).toBeInTheDocument();
    expect(screen.getByLabelText("Credit Term Override")).toBeInTheDocument();
    expect(screen.getByLabelText("Sales Location Override")).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice Description Template")).toBeInTheDocument();
    expect(screen.getByLabelText("Further Description Template")).toBeInTheDocument();
    expect(screen.getByLabelText("Further Description (SMS Intl)")).toBeInTheDocument();
  });

  it("renders Billing Settings fields", () => {
    renderComponent();

    expect(screen.getByLabelText("Billing Mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Consolidate Invoice")).toBeInTheDocument();
    expect(screen.getByLabelText("Discrepancy Threshold (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing Cycle")).toBeInTheDocument();
  });

  it("shows Schedule section content when billing mode is AUTO_PILOT", () => {
    renderComponent({
      data: {
        billingMode: "AUTO_PILOT",
        consolidateInvoice: false,
        discrepancyThreshold: 1,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
      },
    });

    // When billing mode is AUTO_PILOT, schedule fields should be visible (not the message)
    expect(screen.getByLabelText("Day of Month (1-31)")).toBeInTheDocument();
    expect(screen.getByLabelText("Time (HH:mm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Retry Interval (minutes)")).toBeInTheDocument();
    expect(screen.getByLabelText("Max Retries")).toBeInTheDocument();
  });

  it("shows validation errors when required fields are empty", async () => {
    renderComponent();

    // Click Create button without filling required fields
    const createButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Customer name is required")).toBeInTheDocument();
      expect(screen.getByText("AutoCount customer ID is required")).toBeInTheDocument();
      expect(screen.getByText("At least one service must be selected")).toBeInTheDocument();
    });
  });

  it("calls POST on valid submit when not in edit mode", async () => {
    const mockCustomer: Customer = {
      id: "new-id",
      name: "Test Customer",
      autocountCustomerId: "ACC-001",
      services: ["SMS"],
      providers: [],
      reconServers: [],
      rates: { SMS: 0.1, EMAIL: 0, WHATSAPP: 0 },
      billingMode: "MANUAL",
      consolidateInvoice: false,
      discrepancyThreshold: 1.0,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCustomer,
    });

    renderComponent();

    // Fill in required fields
    fireEvent.change(screen.getByLabelText("Customer Name *"), { target: { value: "Test Customer" } });
    fireEvent.change(screen.getByLabelText("AutoCount Customer ID *"), { target: { value: "ACC-001" } });

    // Select SMS service - find the checkbox by its label text
    const smsCheckbox = screen.getByLabelText("SMS");
    fireEvent.click(smsCheckbox);

    // Click Create button
    const createButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("Test Customer"),
      });
    });

    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalledWith(mockCustomer);
    });
  });

  it("calls onBack when Back button is clicked", () => {
    renderComponent();

    const backButton = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "API Error" }),
    });

    // Pass complete data to avoid validation errors
    renderComponent({
      data: {
        name: "Test Customer",
        autocountCustomerId: "ACC-001",
        services: ["SMS"],
        rates: { SMS: 0, EMAIL: 0, WHATSAPP: 0 },
        billingMode: "MANUAL",
        consolidateInvoice: false,
        discrepancyThreshold: 1,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
      },
    });

    // Click Create button
    const createButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(createButton);

    // Wait a bit for the fetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that error message is displayed
    expect(screen.getByText(/API Error/i)).toBeInTheDocument();
  });
});
