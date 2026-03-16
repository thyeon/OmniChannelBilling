"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, History, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface BillingClient {
  id: string;
  source_client_name: string;
  debtor_code: string;
  tax_entity: string;
  address: string;
  is_active: boolean;
}

export default function BillingClientsPage() {
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<BillingClient | null>(null);
  const [formData, setFormData] = useState({
    source_client_name: "",
    debtor_code: "",
    tax_entity: "",
    address: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch("/api/billing/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (_err) {
      console.error("Failed to fetch clients:", _err);
    } finally {
      setIsLoading(false);
    }
  }

  function openAddDialog() {
    setEditingClient(null);
    setFormData({
      source_client_name: "",
      debtor_code: "",
      tax_entity: "",
      address: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(client: BillingClient) {
    setEditingClient(client);
    setFormData({
      source_client_name: client.source_client_name,
      debtor_code: client.debtor_code,
      tax_entity: client.tax_entity,
      address: client.address,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.source_client_name || !formData.debtor_code) {
      alert("Source client name and debtor code are required");
      return;
    }

    setIsSaving(true);

    try {
      if (editingClient) {
        // Update
        const res = await fetch(`/api/billing/clients/${editingClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Failed to update client");
          return;
        }
      } else {
        // Create
        const res = await fetch("/api/billing/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Failed to create client");
          return;
        }
      }

      setDialogOpen(false);
      fetchClients();
    } catch {
      alert("Failed to save client");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(client: BillingClient) {
    if (!confirm(`Are you sure you want to delete "${client.source_client_name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/billing/clients/${client.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete client");
        return;
      }

      fetchClients();
    } catch {
      alert("Failed to delete client");
    }
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
          <h1 className="text-2xl font-bold text-foreground">Client Mapping</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/billing-export/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/billing-export/history">
              <History className="h-4 w-4 mr-2" />
              History
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Client Mappings</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Edit Client Mapping" : "Add Client Mapping"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="source_client_name">Source Client Name</Label>
                  <Input
                    id="source_client_name"
                    value={formData.source_client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, source_client_name: e.target.value })
                    }
                    placeholder="e.g., AIA Malaysia"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debtor_code">Debtor Code</Label>
                  <Input
                    id="debtor_code"
                    value={formData.debtor_code}
                    onChange={(e) =>
                      setFormData({ ...formData, debtor_code: e.target.value })
                    }
                    placeholder="e.g., 300-0001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_entity">Tax Entity</Label>
                  <Input
                    id="tax_entity"
                    value={formData.tax_entity}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_entity: e.target.value })
                    }
                    placeholder="e.g., TIN:C20395547010"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Client address"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No client mappings found. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Name</TableHead>
                  <TableHead>Debtor Code</TableHead>
                  <TableHead>Tax Entity</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.source_client_name}</TableCell>
                    <TableCell className="font-mono">{client.debtor_code}</TableCell>
                    <TableCell className="font-mono text-sm">{client.tax_entity}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {client.address}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "default" : "secondary"}>
                        {client.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(client)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
