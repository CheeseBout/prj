import type { Metadata } from "next";

import { DashboardLayoutShell } from "@/components/layout/dashboard-layout";
import { PracticeClient } from "@/components/practice/practice-client";

export const metadata: Metadata = {
  title: "Practice Room | LexiBridge",
  description: "Run SM-2 practice with flashcards and quizzes",
};

export default function PracticePage() {
  return (
    <DashboardLayoutShell>
      <PracticeClient />
    </DashboardLayoutShell>
  );
}
