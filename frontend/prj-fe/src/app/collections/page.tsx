import { DashboardLayoutShell } from "@/components/layout/dashboard-layout";
import { CollectionsClient } from "@/components/collections/collections-client";

export const metadata = {
  title: "Collections | LexiBridge",
  description: "Manage your vocabulary collections and tags.",
};

export default function CollectionsPage() {
  return (
    <DashboardLayoutShell>
      <CollectionsClient />
    </DashboardLayoutShell>
  );
}
