import type { Metadata } from "next";

import { PracticeClient } from "@/components/practice/practice-client";

export const metadata: Metadata = {
  title: "Practice Room | LexiBridge",
  description: "Run SM-2 practice with flashcards and quizzes",
};

export default function PracticePage() {
  return (
    <main className="relative min-h-screen px-4 py-8 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(0,109,119,0.16),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(255,127,80,0.18),transparent_34%)]" />
      <div className="mx-auto w-full max-w-6xl">
        <PracticeClient />
      </div>
    </main>
  );
}
