"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BillingDefault {
  id: string;
  field_name: string;
  field_value: string;
  is_system: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  sales_location: "Sales Location",
  sales_agent: "Sales Agent",
  credit_term: "Credit Term",
  product_code: "Product Code",
  acc_no: "Account No",
  classification_code: "Classification Code",
  tax_code: "Tax Code",
  inclusive_tax: "Inclusive Tax",
  submit_e_invoice: "Submit E-Invoice",
};

export default function BillingSettingsPage() {
  const [defaults, setDefaults] = useState<BillingDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDefaults();
  }, []);

  async function fetchDefaults() {
    try {
      const res = await fetch("/api/billing/defaults");
      if (res.ok) {
        const data = await res.json();
        setDefaults(data);
      }
    } catch (_err) {
      console.error("Failed to fetch defaults:", _err);
    } finally {
      setIsLoading(false);
    }
  }

  function startEditing(field: BillingDefault) {
    if (field.is_system) return;
    setEditingField(field.field_name);
    setEditValue(field.field_value);
  }

  async function handleSave() {
    if (!editingField) return;

    setIsSaving(true);

    try {
      const res = await fetch("/api/billing/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: editingField,
          field_value: editValue,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update default");
        return;
      }

      setEditingField(null);
      fetchDefaults();
    } catch {
      alert("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEditing() {
    setEditingField(null);
    setEditValue("");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <a href="/billing-export">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Field Defaults</h1>
        </div>
        <Button variant="outline" asChild>
          <a href="/billing-export/history">
            <History className="h-4 w-4 mr-2" />
            History
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Field Values</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaults.map((def) => (
                  <TableRow key={def.id}>
                    <TableCell className="font-medium">
                      {FIELD_LABELS[def.field_name] || def.field_name}
                    </TableCell>
                    <TableCell>
                      {editingField === def.field_name ? (
                        <div className="flex gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 w-[200px]"
                          />
                          <Button size="sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <span className="font-mono">{def.field_value}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {def.is_system ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!def.is_system && editingField !== def.field_name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(def)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
