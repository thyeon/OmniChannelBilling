"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Users,
  Settings,
  History,
  FileText,
  ChevronDown,
  ChevronRight,
  Wand2,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Admin",
    items: [
      { label: "Customers", href: "/admin/customers", icon: <Users className="h-4 w-4" /> },
      { label: "Customer Wizard", href: "/admin/customers/wizard", icon: <Wand2 className="h-4 w-4" /> },
      { label: "AutoCount Settings", href: "/admin/settings/autocount", icon: <Key className="h-4 w-4" /> },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Invoice Generation", href: "/billing/generate", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "Deprecated",
    items: [
      { label: "Overview", href: "/billing", icon: <Receipt className="h-4 w-4" /> },
      { label: "Coway Invoice Generation", href: "/billing/generate-invoice", icon: <FileText className="h-4 w-4" /> },
      { label: "INGLAB Export", href: "/billing-export", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "Export",
    items: [
      { label: "History", href: "/history", icon: <History className="h-4 w-4" /> },
      { label: "Settings", href: "/autocount-settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export function AppSidebar(): React.ReactElement {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Admin: true,
    Billing: true,
    Export: true,
    Deprecated: true,
  });

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <h2 className="text-lg font-bold text-primary">BillingSolutions</h2>
      </div>
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {/* Dashboard always at top */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-2",
            isActive("/")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.label)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {section.label}
              {openSections[section.label] ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>

            {/* Section items */}
            {openSections[section.label] && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ml-2",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
