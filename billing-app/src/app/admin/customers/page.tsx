"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CustomerListItem {
  id: string;
  name: string;
  status?: string;
  billingCycle?: string;
  services?: string[];
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        // Handle both array and {customers: []} formats
        const customerList = Array.isArray(data) ? data : data.customers || [];
        setCustomers(customerList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      SUSPENDED: "bg-yellow-500",
      MAINTENANCE: "bg-blue-500",
    };
    const color = colors[status || ""] || "bg-gray-500";
    return <Badge className={color}>{status || "ACTIVE"}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-gray-600">Manage customer accounts and billing</p>
        </div>
        <Link href="/admin/customers/wizard">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-10">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">No customers found</p>
          <Link href="/admin/customers/wizard">
            <Button variant="outline">Create your first customer</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing Cycle</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{getStatusBadge(customer.status)}</TableCell>
                <TableCell>{customer.billingCycle || "MONTHLY"}</TableCell>
                <TableCell>
                  {customer.services?.join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/customers/wizard?id=${customer.id}`}>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}