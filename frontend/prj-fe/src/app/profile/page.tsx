import type { Metadata } from "next";

import { DashboardLayoutShell } from "@/components/layout/dashboard-layout";
import { ProfileClient } from "@/components/profile/profile-client";

export const metadata: Metadata = {
  title: "Profile | LexiBridge",
  description: "Manage your account and learning settings",
};

export default function ProfilePage() {
  return (
    <DashboardLayoutShell>
      <ProfileClient />
    </DashboardLayoutShell>
  );
}
