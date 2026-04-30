"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Languages, LogIn } from "lucide-react";

import { login } from "@/lib/api";

export const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.replace("/dashboard");
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Login failed. Please check your account information.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel (Branding) ─────────────────────────────── */}
      <div className="hidden flex-1 flex-col justify-between border-r border-foreground/10 bg-white p-12 lg:flex">
        {/* Grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #1A1A1A 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <Link href="/" className="relative z-10">
          <span className="font-serif text-xl font-bold tracking-tight">
            Lexi<span className="text-accent">Bridge</span>
          </span>
        </Link>

        <div className="relative z-10 border-l-2 border-foreground/15 pl-8">
          <h1 className="font-serif text-5xl leading-[1.1]">
            Read smarter with
            <br />
            <em className="italic text-accent">contextual</em> guidance.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/50">
            Sign in to access your personalized vocabulary hub, spaced
            repetition practice, and bilingual learning dashboard.
          </p>
        </div>

        <p className="relative z-10 text-xs text-foreground/30">
          EN-VI Contextual Learning Platform
        </p>
      </div>

      {/* ── Right Panel (Form) ────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="absolute left-8 top-8 lg:hidden">
          <span className="font-serif text-lg font-bold">
            Lexi<span className="text-accent">Bridge</span>
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <p className="editorial-meta text-accent">Welcome back</p>
          <h2 className="mt-3 font-serif text-4xl">
            Sign <em className="italic">in.</em>
          </h2>
          <p className="mt-2 text-sm text-foreground/50">
            Continue your bilingual vocabulary journey.
          </p>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                className="editorial-meta mb-3 block text-foreground/60"
                htmlFor="login-email"
              >
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                className="editorial-meta mb-3 block text-foreground/60"
                htmlFor="login-password"
              >
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
              <LogIn
                size={15}
                className="transition group-hover:translate-x-0.5"
              />
            </button>
          </form>

          <p className="mt-8 text-sm text-foreground/50">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-4 transition hover:decoration-accent"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
