"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { CustomerProductMapping } from "@/domain/models/customerProductMapping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ProductMappingStepProps {
  customerId: string;
  data: CustomerProductMapping[];
  onUpdate: (mappings: CustomerProductMapping[]) => void;
  onNext: () => void;
  onBack: () => void;
}

type ServiceType = "SMS" | "EMAIL" | "WHATSAPP";
type BillingMode = "ITEMIZED" | "LUMP_SUM";

interface MappingFormData {
  serviceType: ServiceType;
  lineIdentifier: string;
  productCode: string;
  description: string;
  furtherDescriptionTemplate: string;
  classificationCode: string;
  unit: string;
  accNo: string;
  taxCode: string;
  billingMode: BillingMode;
  defaultUnitPrice: number;
}

const emptyFormData: MappingFormData = {
  serviceType: "SMS",
  lineIdentifier: "",
  productCode: "",
  description: "",
  furtherDescriptionTemplate: "",
  classificationCode: "",
  unit: "unit",
  accNo: "",
  taxCode: "",
  billingMode: "ITEMIZED",
  defaultUnitPrice: 0,
};

export default function ProductMappingStep({
  customerId,
  data,
  onUpdate,
  onNext,
  onBack,
}: ProductMappingStepProps): React.ReactElement {
  const [mappings, setMappings] = useState<CustomerProductMapping[]>(data);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CustomerProductMapping | null>(null);
  const [formData, setFormData] = useState<MappingFormData>(emptyFormData);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<CustomerProductMapping | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function fetchMappings(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customer-product-mappings?customerId=${customerId}`);
      const data = await res.json();
      setMappings(data);
      onUpdate(data);
    } catch (err) {
      console.error("Failed to fetch mappings:", err);
      setError("Failed to load mappings");
    } finally {
      setIsLoading(false);
    }
  }

  function openAddDialog(): void {
    setEditingMapping(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(mapping: CustomerProductMapping): void {
    setEditingMapping(mapping);
    setFormData({
      serviceType: mapping.serviceType,
      lineIdentifier: mapping.lineIdentifier,
      productCode: mapping.productCode,
      description: mapping.description,
      furtherDescriptionTemplate: mapping.furtherDescriptionTemplate || "",
      classificationCode: mapping.classificationCode,
      unit: mapping.unit,
      accNo: mapping.accNo || "",
      taxCode: mapping.taxCode,
      billingMode: mapping.billingMode,
      defaultUnitPrice: mapping.defaultUnitPrice,
    });
    setDialogOpen(true);
  }

  function openDeleteConfirm(mapping: CustomerProductMapping): void {
    setMappingToDelete(mapping);
    setDeleteConfirmOpen(true);
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setError("");

    try {
      if (editingMapping) {
        // Update existing
        const res = await fetch(`/api/customer-product-mappings/${editingMapping.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update mapping");
        const updated = await res.json();
        setMappings((prev) =>
          prev.map((m) => (m.id === editingMapping.id ? updated : m))
        );
      } else {
        // Create new
        const res = await fetch("/api/customer-product-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, customerId }),
        });
        if (!res.ok) throw new Error("Failed to create mapping");
        const created = await res.json();
        setMappings((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save mapping:", err);
      setError("Failed to save mapping");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!mappingToDelete) return;
    setIsSaving(true);

    try {
      await fetch(`/api/customer-product-mappings/${mappingToDelete.id}`, {
        method: "DELETE",
      });
      setMappings((prev) => prev.filter((m) => m.id !== mappingToDelete.id));
      setDeleteConfirmOpen(false);
      setMappingToDelete(null);
    } catch (err) {
      console.error("Failed to delete mapping:", err);
      setError("Failed to delete mapping");
    } finally {
      setIsSaving(false);
    }
  }

  // Group mappings by serviceType
  const groupedMappings = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.serviceType]) {
      acc[mapping.serviceType] = [];
    }
    acc[mapping.serviceType].push(mapping);
    return acc;
  }, {} as Record<ServiceType, CustomerProductMapping[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Product Mappings</h2>
          <p className="text-sm text-muted-foreground">
            Configure AutoCount product mappings for this customer
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>
      )}

      {mappings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No product mappings configured. Click &quot;Add Mapping&quot; to create one.
        </div>
      ) : (
        Object.entries(groupedMappings).map(([serviceType, serviceMappings]) => (
          <div key={serviceType} className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase">
              {serviceType}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Billing Mode</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>{mapping.lineIdentifier}</TableCell>
                    <TableCell>{mapping.productCode}</TableCell>
                    <TableCell>{mapping.description}</TableCell>
                    <TableCell>{mapping.billingMode}</TableCell>
                    <TableCell className="text-right">
                      ${mapping.defaultUnitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(mapping)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteConfirm(mapping)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next</Button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Mapping" : "Add Mapping"}
            </DialogTitle>
            <DialogDescription>
              Configure the product mapping details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(v: ServiceType) =>
                    setFormData({ ...formData, serviceType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="EMAIL">EMAIL</SelectItem>
                    <SelectItem value="WHATSAPP">WHATSAPP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lineIdentifier">Line Identifier</Label>
                <Input
                  id="lineIdentifier"
                  value={formData.lineIdentifier}
                  onChange={(e) =>
                    setFormData({ ...formData, lineIdentifier: e.target.value })
                  }
                  placeholder="e.g., DOMESTIC"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productCode">Product Code</Label>
                <Input
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) =>
                    setFormData({ ...formData, productCode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="furtherDescriptionTemplate">
                Further Description Template (Optional)
              </Label>
              <Textarea
                id="furtherDescriptionTemplate"
                value={formData.furtherDescriptionTemplate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    furtherDescriptionTemplate: e.target.value,
                  })
                }
                placeholder="Template with placeholders like {month}"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classificationCode">Classification Code</Label>
                <Input
                  id="classificationCode"
                  value={formData.classificationCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      classificationCode: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accNo">Acc No (Optional)</Label>
                <Input
                  id="accNo"
                  value={formData.accNo}
                  onChange={(e) =>
                    setFormData({ ...formData, accNo: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxCode">Tax Code</Label>
                <Input
                  id="taxCode"
                  value={formData.taxCode}
                  onChange={(e) =>
                    setFormData({ ...formData, taxCode: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingMode">Billing Mode</Label>
                <Select
                  value={formData.billingMode}
                  onValueChange={(v: BillingMode) =>
                    setFormData({ ...formData, billingMode: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITEMIZED">ITEMIZED</SelectItem>
                    <SelectItem value="LUMP_SUM">LUMP_SUM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultUnitPrice">Default Unit Price</Label>
                <Input
                  id="defaultUnitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.defaultUnitPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultUnitPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingMapping ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mapping</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this mapping? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}