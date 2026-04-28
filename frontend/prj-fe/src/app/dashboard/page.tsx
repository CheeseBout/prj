import type { Metadata } from "next";

import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Overview | LexiBridge",
  description: "Track vocabulary progress and study streak",
};

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen px-4 py-8 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_12%,rgba(0,109,119,0.16),transparent_32%),radial-gradient(circle_at_92%_18%,rgba(255,127,80,0.16),transparent_28%)]" />
      <div className="mx-auto w-full max-w-7xl">
        <DashboardClient />
      </div>
    </main>
  );
}
