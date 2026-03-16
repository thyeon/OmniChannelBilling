"use client";

import { useState } from "react";
import { FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

interface GenerateResult {
  success: boolean;
  message: string;
  docNo?: string;
}

export default function GenerateInvoicePage(): React.ReactElement {
  // Default to Coway Malaysia customer ID (from MongoDB)
  const [customerId] = useState("coway-malaysia");
  const [billingMonth, setBillingMonth] = useState(formatMonth(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  async function handleGenerate(): Promise<void> {
    if (!customerId || !billingMonth) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/invoices/generate-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, billingMonth }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          message: json.error || "Failed to generate invoice",
        });
        return;
      }

      const invoice = json.invoice;
      if (invoice.status === "DRAFT" || invoice.status === "GENERATED") {
        setResult({
          success: true,
          message: "Invoice generated successfully.",
          docNo: invoice.autocountRefId,
        });
      } else if (invoice.status === "ERROR") {
        setResult({
          success: false,
          message: invoice.syncError || "Invoice generation failed",
        });
      } else {
        setResult({
          success: true,
          message: `Invoice generated (status: ${invoice.status})`,
          docNo: invoice.autocountRefId,
        });
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      setResult({
        success: false,
        message: "Network error — failed to generate invoice",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Generate Invoice
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value="Coway (Malaysia) Sdn Bhd"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              v1: Currently supports only Coway (Malaysia) Sdn Bhd
            </p>
          </div>

          {/* Billing Month */}
          <div className="space-y-2">
            <Label htmlFor="billingMonth">Billing Month</Label>
            <Input
              id="billingMonth"
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
            />
          </div>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isLoading || !customerId || !billingMonth}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice
              </>
            )}
          </Button>

          {/* Result Display */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>
                {result.message}
                {result.docNo && (
                  <span className="block mt-1 font-mono">
                    AutoCount Doc No: {result.docNo}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
