"use client";

import Link from "next/link";
import { Receipt, Users, History } from "lucide-react";
import { useCustomerStore } from "@/store/useCustomerStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export default function DashboardPage(): React.ReactElement {
  const { customers } = useCustomerStore();

  const manualCount = customers.filter((c) => c.billingMode === "MANUAL").length;
  const autoCount = customers.filter((c) => c.billingMode === "AUTO_PILOT").length;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manual Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{manualCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto Pilot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{autoCount}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/billing">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <Receipt className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Generate Invoice</p>
                <p className="text-sm text-muted-foreground">
                  Fetch usage data and create invoices
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/customers">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Manage Customers</p>
                <p className="text-sm text-muted-foreground">
                  Add, edit, or view customer records
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/billing">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 pt-6">
              <History className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Invoice History</p>
                <p className="text-sm text-muted-foreground">
                  View past invoices and sync status
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
