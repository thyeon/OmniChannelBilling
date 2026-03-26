"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { DataSource, DataSourceType, AuthType, ServiceType } from "@/domain/models/dataSource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DataSourceStepProps {
  customerId: string;
  onNext: () => void;
  onBack: () => void;
}

interface LineItemMappingForm {
  lineIdentifier: string;
  countPath: string;
  ratePath: string;
  fallbackRate: string;
}

interface DataSourceFormData {
  name: string;
  type: DataSourceType;
  serviceType: ServiceType;
  apiEndpoint: string;
  authType: AuthType;
  // Auth credentials
  authKey: string;
  authHeaderName: string;
  authToken: string;
  authUsername: string;
  authPassword: string;
  authUser: string;
  authSecret: string;
  // Response mapping
  usageCountPath: string;
  sentPath: string;
  failedPath: string;
  // Advanced
  lineItemMappings: LineItemMappingForm[];
  requestTemplateMethod: "GET" | "POST";
  requestTemplateHeaders: string;
  retryPolicyMaxRetries: number;
  retryPolicyRetryDelaySeconds: number;
  retryPolicyTimeoutSeconds: number;
  fallbackValuesUsageCount: number;
  fallbackValuesSentCount: number;
  fallbackValuesFailedCount: number;
  fallbackValuesUseDefaultOnMissing: boolean;
  // Active
  isActive: boolean;
}

const emptyFormData: DataSourceFormData = {
  name: "",
  type: "COWAY_API",
  serviceType: "SMS",
  apiEndpoint: "",
  authType: "NONE",
  authKey: "",
  authHeaderName: "",
  authToken: "",
  authUsername: "",
  authPassword: "",
  authUser: "",
  authSecret: "",
  usageCountPath: "",
  sentPath: "",
  failedPath: "",
  lineItemMappings: [],
  requestTemplateMethod: "GET",
  requestTemplateHeaders: "",
  retryPolicyMaxRetries: 3,
  retryPolicyRetryDelaySeconds: 1,
  retryPolicyTimeoutSeconds: 30,
  fallbackValuesUsageCount: 0,
  fallbackValuesSentCount: 0,
  fallbackValuesFailedCount: 0,
  fallbackValuesUseDefaultOnMissing: false,
  isActive: true,
};

export default function DataSourceStep({
  customerId,
  onNext,
  onBack,
}: DataSourceStepProps): React.ReactElement {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [formData, setFormData] = useState<DataSourceFormData>(emptyFormData);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<DataSource | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Guard for empty customerId
  if (!customerId) {
    return <div className="p-4 text-muted-foreground">Please complete the Basic Info step first.</div>;
  }

  useEffect(() => {
    fetchDataSources();
  }, [customerId]);

  async function fetchDataSources(): Promise<void> {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/datasources`);
      if (!res.ok) { setError("Failed to fetch data sources"); return; }
      const json = await res.json();
      setDataSources(json.dataSources || []);
    } catch (err) {
      console.error("Failed to fetch data sources:", err);
      setError("Failed to load data sources");
    } finally {
      setIsLoading(false);
    }
  }

  function openAddDialog(): void {
    setEditingDataSource(null);
    setFormData(emptyFormData);
    setFieldErrors({});
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(ds: DataSource): void {
    setEditingDataSource(ds);
    setFormData({
      name: ds.name,
      type: ds.type,
      serviceType: ds.serviceType,
      apiEndpoint: ds.apiEndpoint,
      authType: ds.authType,
      authKey: ds.authCredentials?.key || "",
      authHeaderName: ds.authCredentials?.headerName || "",
      authToken: ds.authCredentials?.token || "",
      authUsername: ds.authCredentials?.username || "",
      authPassword: ds.authCredentials?.password || "",
      authUser: ds.authCredentials?.user || "",
      authSecret: ds.authCredentials?.secret || "",
      usageCountPath: ds.responseMapping?.usageCountPath || "",
      sentPath: ds.responseMapping?.sentPath || "",
      failedPath: ds.responseMapping?.failedPath || "",
      lineItemMappings: ds.lineItemMappings?.map((lim) => ({
        lineIdentifier: lim.lineIdentifier,
        countPath: lim.countPath,
        ratePath: lim.ratePath || "",
        fallbackRate: lim.fallbackRate?.toString() || "",
      })) || [],
      requestTemplateMethod: ds.requestTemplate?.method || "GET",
      requestTemplateHeaders: JSON.stringify(ds.requestTemplate?.headers || {}, null, 2),
      retryPolicyMaxRetries: ds.retryPolicy?.maxRetries || 3,
      retryPolicyRetryDelaySeconds: ds.retryPolicy?.retryDelaySeconds || 1,
      retryPolicyTimeoutSeconds: ds.retryPolicy?.timeoutSeconds || 30,
      fallbackValuesUsageCount: ds.fallbackValues?.usageCount || 0,
      fallbackValuesSentCount: ds.fallbackValues?.sentCount || 0,
      fallbackValuesFailedCount: ds.fallbackValues?.failedCount || 0,
      fallbackValuesUseDefaultOnMissing: ds.fallbackValues?.useDefaultOnMissing || false,
      isActive: ds.isActive,
    });
    setFieldErrors({});
    setError("");
    setDialogOpen(true);
  }

  function openDeleteConfirm(ds: DataSource): void {
    setDataSourceToDelete(ds);
    setDeleteConfirmOpen(true);
  }

  function getAuthCredentials(): DataSource["authCredentials"] | undefined {
    const { authType, authKey, authHeaderName, authToken, authUsername, authPassword, authUser, authSecret, type } = formData;
    if (authType === "API_KEY" && authKey) {
      return { key: authKey, headerName: authHeaderName || undefined };
    }
    if (authType === "BEARER_TOKEN" && authToken) {
      return { token: authToken };
    }
    if (authType === "BASIC_AUTH" && authUsername && authPassword) {
      return { username: authUsername, password: authPassword };
    }
    // COWAY_API uses "user" and "secret" in the request body
    if (type === "COWAY_API" && authUser && authSecret) {
      return { user: authUser, secret: authSecret };
    }
    return undefined;
  }

  function getRequestTemplate(): DataSource["requestTemplate"] | undefined {
    const { requestTemplateMethod, requestTemplateHeaders } = formData;
    if (!requestTemplateMethod && !requestTemplateHeaders) {
      return undefined;
    }
    let headers: Record<string, string> = {};
    try {
      headers = requestTemplateHeaders ? JSON.parse(requestTemplateHeaders) : {};
    } catch {
      // Ignore parse errors
    }
    return {
      method: requestTemplateMethod,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  function getRetryPolicy(): DataSource["retryPolicy"] | undefined {
    const { retryPolicyMaxRetries, retryPolicyRetryDelaySeconds, retryPolicyTimeoutSeconds } = formData;
    if (!retryPolicyMaxRetries && !retryPolicyRetryDelaySeconds && !retryPolicyTimeoutSeconds) {
      return undefined;
    }
    return {
      maxRetries: retryPolicyMaxRetries,
      retryDelaySeconds: retryPolicyRetryDelaySeconds,
      timeoutSeconds: retryPolicyTimeoutSeconds,
    };
  }

  function getFallbackValues(): DataSource["fallbackValues"] | undefined {
    const {
      fallbackValuesUsageCount,
      fallbackValuesSentCount,
      fallbackValuesFailedCount,
      fallbackValuesUseDefaultOnMissing,
    } = formData;
    if (!fallbackValuesUsageCount && !fallbackValuesSentCount && !fallbackValuesFailedCount && !fallbackValuesUseDefaultOnMissing) {
      return undefined;
    }
    return {
      usageCount: fallbackValuesUsageCount,
      sentCount: fallbackValuesSentCount,
      failedCount: fallbackValuesFailedCount,
      useDefaultOnMissing: fallbackValuesUseDefaultOnMissing,
    };
  }

  function getLineItemMappings(): DataSource["lineItemMappings"] | undefined {
    const { lineItemMappings } = formData;
    const validMappings = lineItemMappings.filter(
      (lim) => lim.lineIdentifier && lim.countPath
    );
    if (validMappings.length === 0) {
      return undefined;
    }
    return validMappings.map((lim) => ({
      lineIdentifier: lim.lineIdentifier,
      countPath: lim.countPath,
      ratePath: lim.ratePath || undefined,
      fallbackRate: lim.fallbackRate ? parseFloat(lim.fallbackRate) : undefined,
    }));
  }

  function validateForm(): boolean {
    const newFieldErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newFieldErrors.name = "Name is required";
    }
    if (!formData.type) {
      newFieldErrors.type = "Type is required";
    }
    if (!formData.serviceType) {
      newFieldErrors.serviceType = "Service type is required";
    }
    if (!formData.apiEndpoint?.trim()) {
      newFieldErrors.apiEndpoint = "API endpoint is required";
    }
    if (!formData.authType) {
      newFieldErrors.authType = "Auth type is required";
    }
    if (!formData.usageCountPath?.trim()) {
      newFieldErrors.usageCountPath = "Usage count path is required";
    }

    setFieldErrors(newFieldErrors);
    return Object.keys(newFieldErrors).length === 0;
  }

  async function handleSave(): Promise<void> {
    if (!validateForm()) return;

    setIsSaving(true);
    setError("");

    const payload = {
      name: formData.name,
      type: formData.type,
      serviceType: formData.serviceType,
      apiEndpoint: formData.apiEndpoint,
      authType: formData.authType,
      authCredentials: getAuthCredentials(),
      responseMapping: {
        usageCountPath: formData.usageCountPath,
        sentPath: formData.sentPath || undefined,
        failedPath: formData.failedPath || undefined,
      },
      lineItemMappings: getLineItemMappings(),
      requestTemplate: getRequestTemplate(),
      retryPolicy: getRetryPolicy(),
      fallbackValues: getFallbackValues(),
      isActive: formData.isActive,
    };

    try {
      if (editingDataSource) {
        // Update existing
        const res = await fetch(`/api/customers/${customerId}/datasources/${editingDataSource.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update data source");
        const updated = await res.json();
        setDataSources((prev) =>
          prev.map((ds) => (ds.id === editingDataSource.id ? updated.dataSource : ds))
        );
      } else {
        // Create new
        const res = await fetch(`/api/customers/${customerId}/datasources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create data source");
        const created = await res.json();
        setDataSources((prev) => [...prev, created.dataSource]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Failed to save data source:", err);
      setError("Failed to save data source");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!dataSourceToDelete) return;
    setIsDeleting(true);

    try {
      const delRes = await fetch(`/api/customers/${customerId}/datasources/${dataSourceToDelete.id}`, {
        method: "DELETE",
      });
      if (!delRes.ok) { setError("Failed to delete data source"); return; }
      setDataSources((prev) => prev.filter((ds) => ds.id !== dataSourceToDelete.id));
      setDeleteConfirmOpen(false);
      setDataSourceToDelete(null);
    } catch (err) {
      console.error("Failed to delete data source:", err);
      setError("Failed to delete data source");
    } finally {
      setIsDeleting(false);
    }
  }

  function addLineItemMapping(): void {
    setFormData({
      ...formData,
      lineItemMappings: [
        ...formData.lineItemMappings,
        { lineIdentifier: "", countPath: "", ratePath: "", fallbackRate: "" },
      ],
    });
  }

  function updateLineItemMapping(index: number, field: keyof LineItemMappingForm, value: string): void {
    const updated = [...formData.lineItemMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, lineItemMappings: updated });
  }

  function removeLineItemMapping(index: number): void {
    const updated = formData.lineItemMappings.filter((_, i) => i !== index);
    setFormData({ ...formData, lineItemMappings: updated });
  }

  // Group data sources by serviceType
  const groupedDataSources = dataSources.reduce((acc, ds) => {
    if (!acc[ds.serviceType]) {
      acc[ds.serviceType] = [];
    }
    acc[ds.serviceType].push(ds);
    return acc;
  }, {} as Record<ServiceType, DataSource[]>);

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
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Configure data sources for this customer
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Data Source
        </Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>
      )}

      {dataSources.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No data sources configured. Click &quot;Add Data Source&quot; to create one.
        </div>
      ) : (
        Object.entries(groupedDataSources).map(([serviceType, sources]) => (
          <div key={serviceType} className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase">
              {serviceType}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>API Endpoint</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((ds) => (
                  <TableRow key={ds.id}>
                    <TableCell>{ds.name}</TableCell>
                    <TableCell>{ds.type}</TableCell>
                    <TableCell className="max-w-xs truncate">{ds.apiEndpoint}</TableCell>
                    <TableCell>{ds.authType}</TableCell>
                    <TableCell>{ds.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(ds)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteConfirm(ds)}
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
              {editingDataSource ? "Edit Data Source" : "Add Data Source"}
            </DialogTitle>
            <DialogDescription>
              Configure the data source details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Basic fields - grid layout */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (fieldErrors.name) setFieldErrors((prev) => { const n = { ...prev }; delete n.name; return n; });
                  }}
                  placeholder="e.g., Coway SMS API"
                />
                {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v: DataSourceType) => {
                    setFormData({ ...formData, type: v });
                    if (fieldErrors.type) setFieldErrors((prev) => { const n = { ...prev }; delete n.type; return n; });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COWAY_API">COWAY_API</SelectItem>
                    <SelectItem value="RECON_SERVER">RECON_SERVER</SelectItem>
                    <SelectItem value="CUSTOM_REST_API">CUSTOM_REST_API</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.type && <p className="text-sm text-destructive">{fieldErrors.type}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(v: ServiceType) => {
                    setFormData({ ...formData, serviceType: v });
                    if (fieldErrors.serviceType) setFieldErrors((prev) => { const n = { ...prev }; delete n.serviceType; return n; });
                  }}
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
                {fieldErrors.serviceType && <p className="text-sm text-destructive">{fieldErrors.serviceType}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiEndpoint">API Endpoint *</Label>
                <Input
                  id="apiEndpoint"
                  value={formData.apiEndpoint}
                  onChange={(e) => {
                    setFormData({ ...formData, apiEndpoint: e.target.value });
                    if (fieldErrors.apiEndpoint) setFieldErrors((prev) => { const n = { ...prev }; delete n.apiEndpoint; return n; });
                  }}
                  placeholder="https://api.example.com/usage"
                />
                {fieldErrors.apiEndpoint && <p className="text-sm text-destructive">{fieldErrors.apiEndpoint}</p>}
              </div>
            </div>

            {/* Auth section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="authType">Auth Type *</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(v: AuthType) => {
                    setFormData({ ...formData, authType: v });
                    if (fieldErrors.authType) setFieldErrors((prev) => { const n = { ...prev }; delete n.authType; return n; });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="API_KEY">API_KEY</SelectItem>
                    <SelectItem value="BEARER_TOKEN">BEARER_TOKEN</SelectItem>
                    <SelectItem value="BASIC_AUTH">BASIC_AUTH</SelectItem>
                    <SelectItem value="NONE">NONE</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.authType && <p className="text-sm text-destructive">{fieldErrors.authType}</p>}
              </div>
            </div>

            {/* Conditional auth fields */}
            {/* COWAY_API uses "user" and "secret" in the request body */}
            {formData.type === "COWAY_API" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authUser">User *</Label>
                  <Input
                    id="authUser"
                    value={formData.authUser}
                    onChange={(e) => setFormData({ ...formData, authUser: e.target.value })}
                    placeholder="e.g., gi_xHdw6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authSecret">Secret *</Label>
                  <Input
                    id="authSecret"
                    type="password"
                    value={formData.authSecret}
                    onChange={(e) => setFormData({ ...formData, authSecret: e.target.value })}
                    placeholder="API secret"
                  />
                </div>
              </div>
            )}

            {formData.authType === "API_KEY" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authKey">API Key *</Label>
                  <Input
                    id="authKey"
                    type="password"
                    value={formData.authKey}
                    onChange={(e) => setFormData({ ...formData, authKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authHeaderName">Header Name (Optional)</Label>
                  <Input
                    id="authHeaderName"
                    value={formData.authHeaderName}
                    onChange={(e) => setFormData({ ...formData, authHeaderName: e.target.value })}
                    placeholder="e.g., X-API-Key"
                  />
                </div>
              </div>
            )}
            {formData.authType === "BEARER_TOKEN" && (
              <div className="space-y-2">
                <Label htmlFor="authToken">Bearer Token *</Label>
                <Input
                  id="authToken"
                  type="password"
                  value={formData.authToken}
                  onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
                />
              </div>
            )}
            {formData.authType === "BASIC_AUTH" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authUsername">Username *</Label>
                  <Input
                    id="authUsername"
                    value={formData.authUsername}
                    onChange={(e) => setFormData({ ...formData, authUsername: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authPassword">Password *</Label>
                  <Input
                    id="authPassword"
                    type="password"
                    value={formData.authPassword}
                    onChange={(e) => setFormData({ ...formData, authPassword: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Response Mapping section */}
            <div className="space-y-2 border-t pt-4">
              <h4 className="font-medium">Response Mapping</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usageCountPath">Usage Count Path *</Label>
                  <Input
                    id="usageCountPath"
                    value={formData.usageCountPath}
                    onChange={(e) => {
                      setFormData({ ...formData, usageCountPath: e.target.value });
                      if (fieldErrors.usageCountPath) setFieldErrors((prev) => { const n = { ...prev }; delete n.usageCountPath; return n; });
                    }}
                    placeholder="e.g., data.0.line_items.0.qty"
                  />
                  {fieldErrors.usageCountPath && <p className="text-sm text-destructive">{fieldErrors.usageCountPath}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sentPath">Sent Path (Optional)</Label>
                  <Input
                    id="sentPath"
                    value={formData.sentPath}
                    onChange={(e) => setFormData({ ...formData, sentPath: e.target.value })}
                    placeholder="e.g., data.0.sent"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="failedPath">Failed Path (Optional)</Label>
                <Input
                  id="failedPath"
                  value={formData.failedPath}
                  onChange={(e) => setFormData({ ...formData, failedPath: e.target.value })}
                  placeholder="e.g., data.0.failed"
                />
              </div>
            </div>

            {/* Advanced section */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced Options</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Line Item Mappings */}
                    <div className="space-y-2">
                      <Label>Line Item Mappings</Label>
                      {formData.lineItemMappings.map((lim, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 items-end">
                          <Input
                            placeholder="Line Identifier"
                            value={lim.lineIdentifier}
                            onChange={(e) => updateLineItemMapping(index, "lineIdentifier", e.target.value)}
                          />
                          <Input
                            placeholder="Count Path"
                            value={lim.countPath}
                            onChange={(e) => updateLineItemMapping(index, "countPath", e.target.value)}
                          />
                          <Input
                            placeholder="Rate Path"
                            value={lim.ratePath}
                            onChange={(e) => updateLineItemMapping(index, "ratePath", e.target.value)}
                          />
                          <Input
                            placeholder="Fallback Rate"
                            value={lim.fallbackRate}
                            onChange={(e) => updateLineItemMapping(index, "fallbackRate", e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItemMapping(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addLineItemMapping}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Line Item Mapping
                      </Button>
                    </div>

                    {/* Request Template */}
                    <div className="space-y-2">
                      <Label>Request Template</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={formData.requestTemplateMethod}
                          onValueChange={(v: "GET" | "POST") =>
                            setFormData({ ...formData, requestTemplateMethod: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder='{"Authorization": "Bearer token"}'
                          value={formData.requestTemplateHeaders}
                          onChange={(e) =>
                            setFormData({ ...formData, requestTemplateHeaders: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Retry Policy */}
                    <div className="space-y-2">
                      <Label>Retry Policy</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder="Max Retries"
                          value={formData.retryPolicyMaxRetries}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              retryPolicyMaxRetries: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Retry Delay (s)"
                          value={formData.retryPolicyRetryDelaySeconds}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              retryPolicyRetryDelaySeconds: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Timeout (s)"
                          value={formData.retryPolicyTimeoutSeconds}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              retryPolicyTimeoutSeconds: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Fallback Values */}
                    <div className="space-y-2">
                      <Label>Fallback Values</Label>
                      <div className="grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          placeholder="Usage Count"
                          value={formData.fallbackValuesUsageCount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fallbackValuesUsageCount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Sent Count"
                          value={formData.fallbackValuesSentCount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fallbackValuesSentCount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Failed Count"
                          value={formData.fallbackValuesFailedCount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fallbackValuesFailedCount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="useDefaultOnMissing"
                            checked={formData.fallbackValuesUseDefaultOnMissing}
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                fallbackValuesUseDefaultOnMissing: checked as boolean,
                              })
                            }
                          />
                          <Label htmlFor="useDefaultOnMissing">Use Default</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Active toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDataSource ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Data Source</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this data source? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
