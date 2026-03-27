"use client";

import Link from "next/link";
import { Settings, Users, FileText, CreditCard } from "lucide-react";

export default function AdminPage() {
  const adminSections = [
    {
      title: "Customers",
      description: "Manage customer accounts, data sources, and billing configurations",
      href: "/admin/customers",
      icon: Users,
    },
    {
      title: "AutoCount Settings",
      description: "Configure AutoCount account books and invoice settings",
      href: "/admin/settings/autocount",
      icon: FileText,
    },
    {
      title: "Billing",
      description: "Generate invoices and manage billing cycles",
      href: "/billing",
      icon: CreditCard,
    },
    {
      title: "Settings",
      description: "Application settings and configurations",
      href: "/autocount-settings",
      icon: Settings,
    },
  ];

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-gray-600 mb-8">Manage your billing application</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block p-6 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <section.icon className="w-10 h-10 mb-4 text-blue-600" />
            <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
            <p className="text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}