import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register | LexiBridge",
  description: "Create a new account for contextual EN-VI learning",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
