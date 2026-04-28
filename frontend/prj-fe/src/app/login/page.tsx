import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | LexiBridge",
  description: "Sign in to your bilingual learning workspace",
};

export default function LoginPage() {
  return (
    <main className="relative min-h-screen px-4 py-10 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_12%,rgba(255,127,80,0.18),transparent_28%),radial-gradient(circle_at_10%_78%,rgba(0,109,119,0.18),transparent_34%)]" />
      <div className="mx-auto w-full max-w-6xl">
        <LoginForm />
      </div>
    </main>
  );
}
