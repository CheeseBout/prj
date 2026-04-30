import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | LexiBridge",
  description: "Sign in to your bilingual learning workspace",
};

export default function LoginPage() {
  return <LoginForm />;
}
