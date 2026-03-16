import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { NextAuthSessionProvider } from "@/providers/session-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { DataSeeder } from "@/components/data-seeder";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Billing Automation System",
  description: "Billing automation and invoice management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextAuthSessionProvider>
          <QueryProvider>
            <DataSeeder />
            <div className="flex min-h-screen">
              <AppSidebar />
              <main className="flex-1 md:ml-60">{children}</main>
            </div>
          </QueryProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
