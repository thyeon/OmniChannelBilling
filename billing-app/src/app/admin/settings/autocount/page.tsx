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
  // New fields from Dynamic CaaS
  defaultSalesAgent?: string;
  defaultAccNo?: string;
  defaultClassificationCode?: string;
  inclusiveTax?: boolean;
  submitEInvoice?: boolean;
}

interface ServiceProductMapping {
  id: string;
  accountBookId: string;
  serviceType: "SMS" | "EMAIL" | "WHATSAPP";
  productCode: string;
  description?: string;
  defaultUnitPrice?: number;
  defaultBillingMode?: "ITEMIZED" | "LUMP_SUM";
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
    defaultCreditTerm: "Net 30",
    defaultSalesLocation: "HQ",
    defaultTaxCode: "",
    taxEntity: "",
    invoiceDescriptionTemplate: "",
    furtherDescriptionTemplate: "",
    // New fields
    defaultSalesAgent: "",
    defaultAccNo: "",
    defaultClassificationCode: "",
    inclusiveTax: false,
    submitEInvoice: false,
  });

  // Product mapping form state
  const [productMappingDialogOpen, setProductMappingDialogOpen] = useState(false);
  const [editingProductMapping, setEditingProductMapping] = useState<ServiceProductMapping | null>(null);
  const [productMappingForm, setProductMappingForm] = useState({
    accountBookId: "",
    serviceType: "SMS" as "SMS" | "EMAIL" | "WHATSAPP",
    productCode: "",
    description: "",
    defaultUnitPrice: "",
    defaultBillingMode: "ITEMIZED" as "ITEMIZED" | "LUMP_SUM",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [booksRes, mappingsRes] = await Promise.all([
        fetch("/api/autocount/account-books"),
        fetch("/api/autocount/product-mappings"),
      ]);
      const booksData = await booksRes.json();
      const mappingsData = await mappingsRes.json();
      setAccountBooks(Array.isArray(booksData) ? booksData : booksData.accountBooks || []);
      setProductMappings(Array.isArray(mappingsData) ? mappingsData : mappingsData.mappings || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccountBook = async () => {
    try {
      const url = editingAccountBook
        ? `/api/autocount/account-books/${editingAccountBook.id}`
        : "/api/autocount/account-books";
      const method = editingAccountBook ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountBookForm),
      });

      if (!res.ok) throw new Error("Failed to save");

      setAccountBookDialogOpen(false);
      setEditingAccountBook(null);
      resetAccountBookForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save account book:", error);
      alert("Failed to save account book");
    }
  };

  const handleDeleteAccountBook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account book?")) return;
    try {
      await fetch(`/api/autocount/account-books/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleSaveProductMapping = async () => {
    try {
      const payload = {
        ...productMappingForm,
        defaultUnitPrice: productMappingForm.defaultUnitPrice
          ? parseFloat(productMappingForm.defaultUnitPrice)
          : undefined,
      };

      const url = editingProductMapping
        ? `/api/autocount/product-mappings/${editingProductMapping.id}`
        : "/api/autocount/product-mappings";
      const method = editingProductMapping ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      setProductMappingDialogOpen(false);
      setEditingProductMapping(null);
      resetProductMappingForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save product mapping:", error);
      alert("Failed to save product mapping");
    }
  };

  const handleDeleteProductMapping = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`/api/autocount/product-mappings/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const testConnection = async (book: AutoCountAccountBook) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/autocount/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountBookId: book.accountBookId, keyId: book.keyId, apiKey: book.apiKey }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message || data.error });
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setTestingConnection(false);
    }
  };

  const resetAccountBookForm = () => {
    setAccountBookForm({
      name: "",
      accountBookId: "",
      keyId: "",
      apiKey: "",
      defaultCreditTerm: "Net 30",
      defaultSalesLocation: "HQ",
      defaultTaxCode: "",
      taxEntity: "",
      invoiceDescriptionTemplate: "",
      furtherDescriptionTemplate: "",
      defaultSalesAgent: "",
      defaultAccNo: "",
      defaultClassificationCode: "",
      inclusiveTax: false,
      submitEInvoice: false,
    });
  };

  const resetProductMappingForm = () => {
    setProductMappingForm({
      accountBookId: "",
      serviceType: "SMS",
      productCode: "",
      description: "",
      defaultUnitPrice: "",
      defaultBillingMode: "ITEMIZED",
    });
  };

  const openEditAccountBook = (book: AutoCountAccountBook) => {
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
      defaultSalesAgent: book.defaultSalesAgent || "",
      defaultAccNo: book.defaultAccNo || "",
      defaultClassificationCode: book.defaultClassificationCode || "",
      inclusiveTax: book.inclusiveTax || false,
      submitEInvoice: book.submitEInvoice || false,
    });
    setAccountBookDialogOpen(true);
  };

  const openEditProductMapping = (mapping: ServiceProductMapping) => {
    setEditingProductMapping(mapping);
    setProductMappingForm({
      accountBookId: mapping.accountBookId,
      serviceType: mapping.serviceType,
      productCode: mapping.productCode,
      description: mapping.description || "",
      defaultUnitPrice: mapping.defaultUnitPrice?.toString() || "",
      defaultBillingMode: mapping.defaultBillingMode || "ITEMIZED",
    });
    setProductMappingDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-2">AutoCount Settings</h1>
      <p className="text-gray-600 mb-8">Configure AutoCount account books and service mappings</p>

      {testResult && (
        <Alert className={`mb-4 ${testResult.success ? "bg-green-50" : "bg-red-50"}`}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="account-books">
        <TabsList>
          <TabsTrigger value="account-books">Account Books</TabsTrigger>
          <TabsTrigger value="product-mappings">Service Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="account-books">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Account Books</CardTitle>
                  <CardDescription>Manage AutoCount account book configurations</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    resetAccountBookForm();
                    setEditingAccountBook(null);
                    setAccountBookDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account Book
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accountBooks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No account books configured</p>
              ) : (
                <div className="space-y-4">
                  {accountBooks.map((book) => (
                    <div key={book.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{book.name}</h3>
                          <p className="text-sm text-gray-600">
                            Account ID: {book.accountBookId} | Key ID: {book.keyId}
                          </p>
                          <div className="text-sm text-gray-500 mt-2 grid grid-cols-2 gap-2">
                            <span>Credit Term: {book.defaultCreditTerm}</span>
                            <span>Sales Location: {book.defaultSalesLocation}</span>
                            {book.defaultSalesAgent && <span>Sales Agent: {book.defaultSalesAgent}</span>}
                            {book.defaultAccNo && <span>Acc No: {book.defaultAccNo}</span>}
                            {book.defaultClassificationCode && <span>Classification: {book.defaultClassificationCode}</span>}
                            <span>Inclusive Tax: {book.inclusiveTax ? "Yes" : "No"}</span>
                            <span>Submit e-Invoice: {book.submitEInvoice ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testConnection(book)}
                            disabled={testingConnection}
                          >
                            Test
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditAccountBook(book)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteAccountBook(book.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product-mappings">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Service Product Mappings</CardTitle>
                  <CardDescription>Map services to AutoCount products</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    resetProductMappingForm();
                    setEditingProductMapping(null);
                    setProductMappingDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {productMappings.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No mappings configured</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Book</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Billing Mode</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>{mapping.accountBookId}</TableCell>
                        <TableCell>{mapping.serviceType}</TableCell>
                        <TableCell>{mapping.productCode}</TableCell>
                        <TableCell>{mapping.description || "—"}</TableCell>
                        <TableCell>{mapping.defaultUnitPrice ?? "—"}</TableCell>
                        <TableCell>{mapping.defaultBillingMode || "ITEMIZED"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditProductMapping(mapping)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteProductMapping(mapping.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Book Dialog */}
      <Dialog open={accountBookDialogOpen} onOpenChange={setAccountBookDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAccountBook ? "Edit" : "Add"} Account Book</DialogTitle>
            <DialogDescription>Configure AutoCount account book settings</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={accountBookForm.name} onChange={(e) => setAccountBookForm({ ...accountBookForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Account Book ID</Label>
                <Input value={accountBookForm.accountBookId} onChange={(e) => setAccountBookForm({ ...accountBookForm, accountBookId: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Key ID</Label>
                <Input value={accountBookForm.keyId} onChange={(e) => setAccountBookForm({ ...accountBookForm, keyId: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>API Key</Label>
              <Input type="password" value={accountBookForm.apiKey} onChange={(e) => setAccountBookForm({ ...accountBookForm, apiKey: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Default Credit Term</Label>
                <Input value={accountBookForm.defaultCreditTerm} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultCreditTerm: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Default Sales Location</Label>
                <Input value={accountBookForm.defaultSalesLocation} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultSalesLocation: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Default Tax Code</Label>
                <Input value={accountBookForm.defaultTaxCode} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultTaxCode: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tax Entity</Label>
                <Input value={accountBookForm.taxEntity} onChange={(e) => setAccountBookForm({ ...accountBookForm, taxEntity: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Invoice Description Template</Label>
              <Input value={accountBookForm.invoiceDescriptionTemplate} onChange={(e) => setAccountBookForm({ ...accountBookForm, invoiceDescriptionTemplate: e.target.value })} placeholder="Monthly billing for {CustomerName}" />
            </div>
            <div className="grid gap-2">
              <Label>Further Description Template</Label>
              <Input value={accountBookForm.furtherDescriptionTemplate} onChange={(e) => setAccountBookForm({ ...accountBookForm, furtherDescriptionTemplate: e.target.value })} placeholder="Billing period: {BillingCycle}" />
            </div>
            <div className="border-t pt-4 mt-2">
              <h4 className="font-semibold mb-3">Dynamic CaaS Fields (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Default Sales Agent</Label>
                  <Input value={accountBookForm.defaultSalesAgent} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultSalesAgent: e.target.value })} placeholder="Olivia Yap" />
                </div>
                <div className="grid gap-2">
                  <Label>Default Acc No</Label>
                  <Input value={accountBookForm.defaultAccNo} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultAccNo: e.target.value })} placeholder="500-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="grid gap-2">
                  <Label>Default Classification Code</Label>
                  <Input value={accountBookForm.defaultClassificationCode} onChange={(e) => setAccountBookForm({ ...accountBookForm, defaultClassificationCode: e.target.value })} placeholder="022" />
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={accountBookForm.inclusiveTax} onChange={(e) => setAccountBookForm({ ...accountBookForm, inclusiveTax: e.target.checked })} />
                    Inclusive Tax
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={accountBookForm.submitEInvoice} onChange={(e) => setAccountBookForm({ ...accountBookForm, submitEInvoice: e.target.checked })} />
                    Submit e-Invoice
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccountBookDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccountBook}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Mapping Dialog */}
      <Dialog open={productMappingDialogOpen} onOpenChange={setProductMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProductMapping ? "Edit" : "Add"} Product Mapping</DialogTitle>
            <DialogDescription>Map a service to an AutoCount product</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Account Book ID</Label>
              <select
                className="border rounded p-2"
                value={productMappingForm.accountBookId}
                onChange={(e) => setProductMappingForm({ ...productMappingForm, accountBookId: e.target.value })}
              >
                <option value="">Select account book</option>
                {accountBooks.map((book) => (
                  <option key={book.id} value={book.accountBookId}>
                    {book.name} ({book.accountBookId})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Service Type</Label>
              <select
                className="border rounded p-2"
                value={productMappingForm.serviceType}
                onChange={(e) => setProductMappingForm({ ...productMappingForm, serviceType: e.target.value as "SMS" | "EMAIL" | "WHATSAPP" })}
              >
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Product Code</Label>
              <Input value={productMappingForm.productCode} onChange={(e) => setProductMappingForm({ ...productMappingForm, productCode: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={productMappingForm.description} onChange={(e) => setProductMappingForm({ ...productMappingForm, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Default Unit Price</Label>
              <Input type="number" step="0.01" value={productMappingForm.defaultUnitPrice} onChange={(e) => setProductMappingForm({ ...productMappingForm, defaultUnitPrice: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Billing Mode</Label>
              <select
                className="border rounded p-2"
                value={productMappingForm.defaultBillingMode}
                onChange={(e) => setProductMappingForm({ ...productMappingForm, defaultBillingMode: e.target.value as "ITEMIZED" | "LUMP_SUM" })}
              >
                <option value="ITEMIZED">Itemized</option>
                <option value="LUMP_SUM">Lump Sum</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProductMappingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProductMapping}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Import Table components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";