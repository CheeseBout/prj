import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register | LexiBridge",
  description: "Create a new account for contextual EN-VI learning",
};

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen px-4 py-10 md:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_12%,rgba(0,109,119,0.2),transparent_34%),radial-gradient(circle_at_84%_86%,rgba(255,127,80,0.2),transparent_30%)]" />
      <div className="mx-auto w-full max-w-6xl">
        <RegisterForm />
      </div>
    </main>
  );
}
