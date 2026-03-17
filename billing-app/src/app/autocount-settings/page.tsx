"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, Edit, CheckCircle, XCircle } from "lucide-react";

interface AutoCountAccountBook {
  id: string;
  name: string;
  accountBookId: string;
  keyId: string;
  apiKey: string;
  defaultCreditTerm: string;
  defaultSalesLocation: string;
  defaultTaxCode?: string;
  taxEntity?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}

interface ServiceProductMapping {
  id: string;
  accountBookId: string;
  serviceType: "SMS" | "EMAIL" | "WHATSAPP";
  productCode: string;
  description?: string;
  defaultUnitPrice?: number;
  defaultBillingMode?: "ITEMIZED" | "LUMP_SUM";
  taxCode?: string;
  invoiceDescriptionTemplate?: string;
  furtherDescriptionTemplate?: string;
}

export default function AutoCountSettingsPage() {
  const [accountBooks, setAccountBooks] = useState<AutoCountAccountBook[]>([]);
  const [productMappings, setProductMappings] = useState<ServiceProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Account book form state
  const [accountBookDialogOpen, setAccountBookDialogOpen] = useState(false);
  const [editingAccountBook, setEditingAccountBook] = useState<AutoCountAccountBook | null>(null);
  const [accountBookForm, setAccountBookForm] = useState({
    name: "",
    accountBookId: "",
    keyId: "",
    apiKey: "",
    defaultCreditTerm: "Net 30 days",
    defaultSalesLocation: "HQ",
    defaultTaxCode: "",
    taxEntity: "",
    invoiceDescriptionTemplate: "",
    furtherDescriptionTemplate: "",
  });

  // Product mapping form state
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ServiceProductMapping | null>(null);
  const [mappingForm, setMappingForm] = useState({
    accountBookId: "",
    serviceType: "SMS" as "SMS" | "EMAIL" | "WHATSAPP",
    productCode: "",
    description: "",
    defaultUnitPrice: "",
    defaultBillingMode: "LUMP_SUM" as "ITEMIZED" | "LUMP_SUM",
    taxCode: "",
    invoiceDescriptionTemplate: "",
    furtherDescriptionTemplate: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksRes, mappingsRes] = await Promise.all([
        fetch("/api/autocount/account-books"),
        fetch("/api/autocount/product-mappings"),
      ]);
      const booksData = await booksRes.json();
      const mappingsData = await mappingsRes.json();
      setAccountBooks(booksData.accountBooks || []);
      setProductMappings(mappingsData.mappings || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/autocount/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountBookId: accountBookForm.accountBookId,
          keyId: accountBookForm.keyId,
          apiKey: accountBookForm.apiKey,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? "Connection successful!" : data.error || "Connection failed",
      });
    } catch {
      setTestResult({ success: false, message: "Failed to test connection" });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveAccountBook = async () => {
    try {
      const url = editingAccountBook
        ? `/api/autocount/account-books/${editingAccountBook.id}`
        : "/api/autocount/account-books";
      const res = await fetch(url, {
        method: editingAccountBook ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountBookForm),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save account book");
        return;
      }

      setAccountBookDialogOpen(false);
      resetAccountBookForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save account book:", error);
    }
  };

  const deleteAccountBook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account book?")) return;
    try {
      const res = await fetch(`/api/autocount/account-books/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete account book");
        return;
      }
      fetchData();
    } catch (error) {
      console.error("Failed to delete account book:", error);
    }
  };

  const saveProductMapping = async () => {
    try {
      const url = editingMapping
        ? `/api/autocount/product-mappings/${editingMapping.id}`
        : "/api/autocount/product-mappings";
      const res = await fetch(url, {
        method: editingMapping ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingForm),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save product mapping");
        return;
      }

      setMappingDialogOpen(false);
      resetMappingForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save product mapping:", error);
    }
  };

  const deleteProductMapping = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mapping?")) return;
    try {
      const res = await fetch(`/api/autocount/product-mappings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("Failed to delete product mapping");
        return;
      }
      fetchData();
    } catch (error) {
      console.error("Failed to delete product mapping:", error);
    }
  };

  const resetAccountBookForm = () => {
    setEditingAccountBook(null);
    setAccountBookForm({
      name: "",
      accountBookId: "",
      keyId: "",
      apiKey: "",
      defaultCreditTerm: "Net 30 days",
      defaultSalesLocation: "HQ",
      defaultTaxCode: "",
      taxEntity: "",
      invoiceDescriptionTemplate: "",
      furtherDescriptionTemplate: "",
    });
    setTestResult(null);
  };

  const resetMappingForm = () => {
    setEditingMapping(null);
    setMappingForm({
      accountBookId: "",
      serviceType: "SMS",
      productCode: "",
      description: "",
      defaultUnitPrice: "",
      defaultBillingMode: "LUMP_SUM",
      taxCode: "",
      invoiceDescriptionTemplate: "",
      furtherDescriptionTemplate: "",
    });
  };

  const openAccountBookDialog = (book?: AutoCountAccountBook) => {
    if (book) {
      setEditingAccountBook(book);
      setAccountBookForm({
        name: book.name,
        accountBookId: book.accountBookId,
        keyId: book.keyId,
        apiKey: book.apiKey,
        defaultCreditTerm: book.defaultCreditTerm,
        defaultSalesLocation: book.defaultSalesLocation,
        defaultTaxCode: book.defaultTaxCode || "",
        taxEntity: book.taxEntity || "",
        invoiceDescriptionTemplate: book.invoiceDescriptionTemplate || "",
        furtherDescriptionTemplate: book.furtherDescriptionTemplate || "",
      });
    } else {
      resetAccountBookForm();
    }
    setAccountBookDialogOpen(true);
  };

  const openMappingDialog = (mapping?: ServiceProductMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setMappingForm({
        accountBookId: mapping.accountBookId,
        serviceType: mapping.serviceType,
        productCode: mapping.productCode,
        description: mapping.description || "",
        defaultUnitPrice: mapping.defaultUnitPrice?.toString() || "",
        defaultBillingMode: mapping.defaultBillingMode || "LUMP_SUM",
        taxCode: mapping.taxCode || "",
        invoiceDescriptionTemplate: mapping.invoiceDescriptionTemplate || "",
        furtherDescriptionTemplate: mapping.furtherDescriptionTemplate || "",
      });
    } else {
      resetMappingForm();
    }
    setMappingDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AutoCount Settings</h1>
        <p className="text-muted-foreground">Manage AutoCount Cloud Accounting integration</p>
      </div>

      <Tabs defaultValue="account-books" className="space-y-4">
        <TabsList>
          <TabsTrigger value="account-books">Account Books</TabsTrigger>
          <TabsTrigger value="product-mappings">Product Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="account-books" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AutoCount Account Books</CardTitle>
              <CardDescription>
                Manage your AutoCount Cloud Accounting account books and credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={() => openAccountBookDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account Book
                </Button>
              </div>

              {accountBooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No account books configured. Add one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {accountBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h3 className="font-semibold">{book.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Account Book ID: {book.accountBookId}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Default: {book.defaultCreditTerm} | {book.defaultSalesLocation} {book.defaultTaxCode ? `| Tax: ${book.defaultTaxCode}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAccountBookDialog(book)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAccountBook(book.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product-mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Product Mappings</CardTitle>
              <CardDescription>
                Map service types to AutoCount product codes per account book
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={() => openMappingDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mapping
                </Button>
              </div>

              {productMappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No product mappings configured. Add one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {productMappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {mapping.serviceType} → {mapping.productCode}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {accountBooks.find((b) => b.id === mapping.accountBookId)?.name || "Unknown Account Book"}
                        </p>
                        {mapping.description && (
                          <p className="text-sm text-muted-foreground">{mapping.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMappingDialog(mapping)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProductMapping(mapping.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Book Dialog */}
      <Dialog open={accountBookDialogOpen} onOpenChange={setAccountBookDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccountBook ? "Edit Account Book" : "Add Account Book"}
            </DialogTitle>
            <DialogDescription>
              Configure your AutoCount Cloud Accounting account book credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={accountBookForm.name}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, name: e.target.value })}
                  placeholder="G-I Main Book"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountBookId">Account Book ID *</Label>
                <Input
                  id="accountBookId"
                  value={accountBookForm.accountBookId}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, accountBookId: e.target.value })}
                  placeholder="4013"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keyId">Key-ID *</Label>
                <Input
                  id="keyId"
                  value={accountBookForm.keyId}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, keyId: e.target.value })}
                  placeholder="671f8a54-..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={accountBookForm.apiKey}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, apiKey: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditTerm">Default Credit Term *</Label>
                <Input
                  id="creditTerm"
                  value={accountBookForm.defaultCreditTerm}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultCreditTerm: e.target.value })}
                  placeholder="Net 30 days"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salesLocation">Default Sales Location *</Label>
                <Input
                  id="salesLocation"
                  value={accountBookForm.defaultSalesLocation}
                  onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultSalesLocation: e.target.value })}
                  placeholder="HQ"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultTaxCode">Default Tax Code (Optional)</Label>
              <Input
                id="defaultTaxCode"
                value={accountBookForm.defaultTaxCode}
                onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultTaxCode: e.target.value })}
                placeholder="SV-6"
              />
              <p className="text-xs text-muted-foreground">
                Tax code for invoice line items (e.g., SV-6, SR, ZRL). Leave empty to not apply tax.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxEntity">Tax Entity (Optional)</Label>
              <Input
                id="taxEntity"
                value={accountBookForm.taxEntity}
                onChange={(e) => setAccountBookForm({ ...accountBookForm, taxEntity: e.target.value })}
                placeholder="TIN:C12113374050"
              />
              <p className="text-xs text-muted-foreground">
                Tax identification number (e.g., TIN:C12113374050). Shown on invoice.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDescTemplate">Invoice Description Template</Label>
              <Input
                id="invoiceDescTemplate"
                value={accountBookForm.invoiceDescriptionTemplate}
                onChange={(e) => setAccountBookForm({ ...accountBookForm, invoiceDescriptionTemplate: e.target.value })}
                placeholder="SMS Billing - {BillingCycle}"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{BillingCycle}"}, {"{CustomerName}"}, {"{TotalAmount}"}, {"{SMSCount}"}, {"{SMSRate}"}, {"{SMSTotal}"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="furtherDescTemplate">Further Description Template</Label>
              <Input
                id="furtherDescTemplate"
                value={accountBookForm.furtherDescriptionTemplate}
                onChange={(e) => setAccountBookForm({ ...accountBookForm, furtherDescriptionTemplate: e.target.value })}
                placeholder="For {BillingCycle}, the total number of SMS messages sent via ECS Service was {SMSCount}, charged at {SMSRate} per message."
              />
              <p className="text-xs text-muted-foreground">
                Applied to each invoice line item. Same placeholders as above.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={!accountBookForm.accountBookId || !accountBookForm.keyId || !accountBookForm.apiKey || testingConnection}
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccountBookDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAccountBook}>
              {editingAccountBook ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Product Mapping" : "Add Product Mapping"}
            </DialogTitle>
            <DialogDescription>
              Map a service type to an AutoCount product code
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mappingAccountBook">Account Book *</Label>
              <select
                id="mappingAccountBook"
                className="w-full p-2 border rounded-md"
                value={mappingForm.accountBookId}
                onChange={(e) => setMappingForm({ ...mappingForm, accountBookId: e.target.value })}
              >
                <option value="">Select an account book</option>
                {accountBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type *</Label>
              <select
                id="serviceType"
                className="w-full p-2 border rounded-md"
                value={mappingForm.serviceType}
                onChange={(e) => setMappingForm({ ...mappingForm, serviceType: e.target.value as "SMS" | "EMAIL" | "WHATSAPP" })}
              >
                <option value="SMS">SMS</option>
                <option value="EMAIL">EMAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productCode">Product Code *</Label>
              <Input
                id="productCode"
                value={mappingForm.productCode}
                onChange={(e) => setMappingForm({ ...mappingForm, productCode: e.target.value })}
                placeholder="SMS-Enhanced"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={mappingForm.description}
                onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })}
                placeholder="SMS Blast on ECS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultUnitPrice">Default Unit Price (Optional)</Label>
              <Input
                id="defaultUnitPrice"
                type="number"
                step="0.01"
                value={mappingForm.defaultUnitPrice}
                onChange={(e) => setMappingForm({ ...mappingForm, defaultUnitPrice: e.target.value })}
                placeholder="0.079"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultBillingMode">Default Billing Mode</Label>
              <select
                id="defaultBillingMode"
                className="w-full p-2 border rounded-md"
                value={mappingForm.defaultBillingMode}
                onChange={(e) => setMappingForm({ ...mappingForm, defaultBillingMode: e.target.value as "ITEMIZED" | "LUMP_SUM" })}
              >
                <option value="LUMP_SUM">Lump Sum (qty=1, unitPrice=total)</option>
                <option value="ITEMIZED">Itemized (qty=count, unitPrice=rate)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Lump Sum avoids AutoCount&apos;s 2 decimal place rounding on unit price.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxCode">Tax Code (Optional)</Label>
              <Input
                id="taxCode"
                value={mappingForm.taxCode}
                onChange={(e) => setMappingForm({ ...mappingForm, taxCode: e.target.value })}
                placeholder="SV-6"
              />
              <p className="text-xs text-muted-foreground">
                AutoCount tax code (e.g., SV-6, SV-8, SR, ZS). Overrides account book default.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDescriptionTemplate">Invoice Description Template (Optional)</Label>
              <Input
                id="invoiceDescriptionTemplate"
                value={mappingForm.invoiceDescriptionTemplate}
                onChange={(e) => setMappingForm({ ...mappingForm, invoiceDescriptionTemplate: e.target.value })}
                placeholder="e.g., Email Service - {BillingCycle}"
              />
              <p className="text-xs text-muted-foreground">
                Template for line item description. Use placeholders: {'{BillingCycle}'}, {'{EmailCount}'}, {'{EmailRate}'}, {'{EmailTotal}'}, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="furtherDescriptionTemplate">Further Description Template (Optional)</Label>
              <Input
                id="furtherDescriptionTemplate"
                value={mappingForm.furtherDescriptionTemplate}
                onChange={(e) => setMappingForm({ ...mappingForm, furtherDescriptionTemplate: e.target.value })}
                placeholder="e.g., For {BillingCycle}, {EmailCount} emails at {EmailRate}"
              />
              <p className="text-xs text-muted-foreground">
                Template for further description. Use placeholders: {'{BillingCycle}'}, {'{SMSCount}'}, {'{SMSRate}'}, {'{EmailCount}'}, {'{EmailRate}'}, etc.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveProductMapping}>
              {editingMapping ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
