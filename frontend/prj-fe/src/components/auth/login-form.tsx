"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, BookOpenText, Languages, Lock, LogIn, Mail, Sparkles } from "lucide-react";

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
    <div className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
      <section className="panel rounded-3xl p-6 md:p-8">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to landing
        </Link>

        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#0f4c5c]">
            <Sparkles size={13} />
            Welcome back
          </span>
          <h1 className="mt-4 text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Continue your bilingual vocabulary journey.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f4c5c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
            <LogIn size={16} />
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          New here?{" "}
          <Link href="/register" className="font-semibold text-[#0f4c5c] hover:underline">
            Create an account
          </Link>
        </p>
      </section>

      <section className="panel hidden rounded-3xl p-8 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Inside LexiBridge</p>
        <h2 className="mt-3 text-4xl leading-tight">
          Read smarter with contextual English-Vietnamese guidance.
        </h2>

        <div className="mt-8 space-y-4">
          <article className="rounded-2xl border border-slate-900/10 bg-white/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Languages size={16} className="text-[#0f4c5c]" />
              Bilingual explanations
            </p>
            <p className="mt-2 text-sm text-slate-600">
              View concise English and Vietnamese explanations side by side.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-900/10 bg-white/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <BookOpenText size={16} className="text-[#ff7f50]" />
              Vocabulary hub
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Save terms with source context and review them by status.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};
