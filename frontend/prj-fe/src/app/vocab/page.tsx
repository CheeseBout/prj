import type { Metadata } from "next";

import { VocabClient } from "@/components/vocab/vocab-client";

export const metadata: Metadata = {
  title: "Vocabulary Hub | LexiBridge",
  description: "Search and filter saved contextual vocabulary",
};

export default function VocabPage() {
  return (
    <main className="relative min-h-screen px-4 py-8 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(0,109,119,0.17),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(255,127,80,0.17),transparent_30%)]" />
      <div className="mx-auto w-full max-w-7xl">
        <VocabClient />
      </div>
    </main>
  );
}
