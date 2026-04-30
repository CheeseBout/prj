import type { Metadata } from "next";

import { DashboardLayoutShell } from "@/components/layout/dashboard-layout";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Overview | LexiBridge",
  description: "Track vocabulary progress and study streak",
};

export default function DashboardPage() {
  return (
    <DashboardLayoutShell>
      <DashboardClient />
    </DashboardLayoutShell>
  );
}
