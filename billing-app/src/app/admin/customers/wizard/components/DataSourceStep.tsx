"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Edit, Plus, Eye, Loader2, Database, Key, FileJson } from "lucide-react";

type DataSourceType = "COWAY_API" | "RECON_SERVER" | "CUSTOM_REST_API";
type AuthType = "API_KEY" | "BEARER_TOKEN" | "BASIC_AUTH" | "NONE";
type ServiceType = "SMS" | "EMAIL" | "WHATSAPP";

interface DataSource {
  id: string;
  customerId: string;
  type: DataSourceType;
  serviceType: ServiceType;
  name: string;
  apiEndpoint: string;
  authType: AuthType;
  authCredentials?: {
    key?: string;
    token?: string;
    username?: string;
    password?: string;
  };
  responseMapping: {
    usageCountPath: string;
    sentPath?: string;
    failedPath?: string;
  };
  isActive: boolean;
}

interface DataSourceStepProps {
  customerId: string;
  onChange?: (dataSources: DataSource[]) => void;
}

const DATA_SOURCE_TYPES: { value: DataSourceType; label: string }[] = [
  { value: "COWAY_API", label: "Coway API" },
  { value: "RECON_SERVER", label: "Recon Server" },
  { value: "CUSTOM_REST_API", label: "Custom REST API" },
];

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "API_KEY", label: "API Key" },
  { value: "BEARER_TOKEN", label: "Bearer Token" },
  { value: "BASIC_AUTH", label: "Basic Auth" },
];

const initialFormState = {
  type: "CUSTOM_REST_API" as DataSourceType,
  serviceType: "SMS" as ServiceType,
  name: "",
  apiEndpoint: "",
  authType: "NONE" as AuthType,
  authKey: "",
  authToken: "",
  authUsername: "",
  authPassword: "",
  usageCountPath: "data.0.count",
  sentPath: "",
  failedPath: "",
  isActive: true,
};

export default function DataSourceStep({ customerId, onChange }: DataSourceStepProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch data sources on mount
  useEffect(() => {
    if (customerId) {
      fetchDataSources();
    }
  }, [customerId]);

  // Notify parent of changes
  useEffect(() => {
    onChange?.(dataSources);
  }, [dataSources, onChange]);

  async function fetchDataSources() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/datasources`);
      if (res.ok) {
        const data = await res.json();
        setDataSources(data.dataSources || []);
      }
    } catch (err) {
      console.error("Failed to fetch data sources:", err);
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (ds: DataSource) => {
    setEditingId(ds.id);
    setForm({
      type: ds.type,
      serviceType: ds.serviceType,
      name: ds.name,
      apiEndpoint: ds.apiEndpoint,
      authType: ds.authType,
      authKey: ds.authCredentials?.key || "",
      authToken: ds.authCredentials?.token || "",
      authUsername: ds.authCredentials?.username || "",
      authPassword: ds.authCredentials?.password || "",
      usageCountPath: ds.responseMapping.usageCountPath,
      sentPath: ds.responseMapping.sentPath || "",
      failedPath: ds.responseMapping.failedPath || "",
      isActive: ds.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.apiEndpoint.trim() || !form.usageCountPath.trim()) {
      setError("Name, API Endpoint, and Usage Count Path are required");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      type: form.type,
      serviceType: form.serviceType,
      name: form.name,
      apiEndpoint: form.apiEndpoint,
      authType: form.authType,
      authCredentials: form.authType === "API_KEY"
        ? { key: form.authKey }
        : form.authType === "BEARER_TOKEN"
        ? { token: form.authToken }
        : form.authType === "BASIC_AUTH"
        ? { username: form.authUsername, password: form.authPassword }
        : undefined,
      responseMapping: {
        usageCountPath: form.usageCountPath,
        sentPath: form.sentPath || undefined,
        failedPath: form.failedPath || undefined,
      },
      isActive: form.isActive,
    };

    try {
      const url = editingId
        ? `/api/customers/${customerId}/datasources/${editingId}`
        : `/api/customers/${customerId}/datasources`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save data source");
      }

      setDialogOpen(false);
      resetForm();
      fetchDataSources();
      setSuccess("Data source saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save data source");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this data source?")) return;

    try {
      const res = await fetch(`/api/customers/${customerId}/datasources/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete data source");
      }

      fetchDataSources();
      setSuccess("Data source deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete data source");
    }
  };

  const handlePreview = async (ds: DataSource) => {
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      // Call the preview endpoint to test data source
      const res = await fetch(`/api/customers/${customerId}/datasources/${ds.id}/preview`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      } else {
        setPreviewData({ error: "Failed to fetch preview data" });
      }
    } catch {
      setPreviewData({ error: "Failed to connect to data source" });
    } finally {
      setPreviewLoading(false);
      setPreviewOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading data sources...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Data Sources</h3>
          <p className="text-sm text-muted-foreground">
            Configure endpoints for fetching billable usage data
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Data Sources List */}
      {dataSources.length === 0 ? (
        <div className="p-8 text-center border rounded-lg">
          <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No data sources configured</p>
          <Button variant="outline" className="mt-4" onClick={openAddDialog}>
            Add your first data source
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dataSources.map((ds) => (
            <Card key={ds.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{ds.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {ds.type} - {ds.serviceType}
                    </CardDescription>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${ds.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {ds.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-3 truncate">
                  {ds.apiEndpoint}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(ds)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(ds)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(ds.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Data Source" : "Add Data Source"}</DialogTitle>
            <DialogDescription>
              Configure the data source endpoint and authentication settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type and Service Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as DataSourceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Type *</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) => setForm({ ...form, serviceType: v as ServiceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Coway SMS API"
              />
            </div>

            {/* API Endpoint */}
            <div className="space-y-2">
              <Label>API Endpoint *</Label>
              <Input
                value={form.apiEndpoint}
                onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                placeholder="https://api.example.com/usage"
              />
            </div>

            {/* Auth Type */}
            <div className="space-y-2">
              <Label>Authentication Type</Label>
              <Select
                value={form.authType}
                onValueChange={(v) => setForm({ ...form, authType: v as AuthType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auth Credentials */}
            {form.authType === "API_KEY" && (
              <div className="space-y-2">
                <Label>
                  <Key className="h-3 w-3 inline mr-1" />
                  API Key
                </Label>
                <Input
                  value={form.authKey}
                  onChange={(e) => setForm({ ...form, authKey: e.target.value })}
                  placeholder="Enter API key"
                  type="password"
                />
              </div>
            )}
            {form.authType === "BEARER_TOKEN" && (
              <div className="space-y-2">
                <Label>
                  <Key className="h-3 w-3 inline mr-1" />
                  Bearer Token
                </Label>
                <Input
                  value={form.authToken}
                  onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                  placeholder="Enter bearer token"
                  type="password"
                />
              </div>
            )}
            {form.authType === "BASIC_AUTH" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={form.authUsername}
                    onChange={(e) => setForm({ ...form, authUsername: e.target.value })}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    value={form.authPassword}
                    onChange={(e) => setForm({ ...form, authPassword: e.target.value })}
                    placeholder="Password"
                    type="password"
                  />
                </div>
              </div>
            )}

            {/* Response Mapping */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center">
                <FileJson className="h-4 w-4 mr-2" />
                Response Mapping
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Usage Count Path *</Label>
                  <Input
                    value={form.usageCountPath}
                    onChange={(e) => setForm({ ...form, usageCountPath: e.target.value })}
                    placeholder="e.g., data.0.count"
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON path to usage count in API response
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sent Count Path</Label>
                    <Input
                      value={form.sentPath}
                      onChange={(e) => setForm({ ...form, sentPath: e.target.value })}
                      placeholder="e.g., data.0.sent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Failed Count Path</Label>
                    <Input
                      value={form.failedPath}
                      onChange={(e) => setForm({ ...form, failedPath: e.target.value })}
                      placeholder="e.g., data.0.failed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive" className="font-normal">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Data Source Preview</DialogTitle>
            <DialogDescription>
              Sample data retrieved from the configured endpoint
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Fetching preview data...</span>
            </div>
          ) : previewData ? (
            <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">No preview data available</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
