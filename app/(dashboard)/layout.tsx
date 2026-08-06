import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-h-screen">
          {/* Navbar */}
          <Navbar />
          
          {/* Page Content */}
          <main className="flex-grow p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
