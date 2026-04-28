"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Lock,
  Mail,
  Sparkles,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import { login, register } from "@/lib/api";

type RegisterStep = 1 | 2;

export const RegisterForm = () => {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    dob: "",
    gender: true,
    major: "",
    englishLevel: "",
  });

  const gotoStepTwo = () => {
    if (!form.fullName || !form.email || !form.password || !form.confirmPassword) {
      setError("Please fill all required fields on step 1.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must have at least 8 characters.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        email: form.email,
        password: form.password,
        full_name: form.fullName,
        dob: form.dob || "1990-01-01",
        gender: form.gender,
        major: form.major || undefined,
        english_level: form.englishLevel || undefined,
      });

      await login({ email: form.email, password: form.password });
      router.replace("/dashboard");
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
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
            Create account
          </span>
          <h1 className="mt-4 text-4xl">Join LexiBridge</h1>
          <p className="mt-2 text-sm text-slate-600">
            Build your personalized English-Vietnamese learning workspace.
          </p>
        </div>

        <div className="mb-7 flex items-center gap-2">
          <div
            className={`h-2 rounded-full transition-all ${
              step === 1 ? "w-12 bg-[#0f4c5c]" : "w-5 bg-slate-300"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step === 2 ? "w-12 bg-[#0f4c5c]" : "w-5 bg-slate-300"
            }`}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="fullName">
                  Full name
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                    placeholder="Nguyen Van A"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                      placeholder="At least 8 chars"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      minLength={8}
                      value={form.confirmPassword}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={gotoStepTwo}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f4c5c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77]"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="dob">
                    Date of birth
                  </label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      id="dob"
                      type="date"
                      value={form.dob}
                      onChange={(event) => setForm((prev) => ({ ...prev, dob: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="gender">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={form.gender ? "male" : "female"}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, gender: event.target.value === "male" }))
                    }
                    className="w-full rounded-2xl border border-slate-900/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="major">
                  Major
                </label>
                <input
                  id="major"
                  type="text"
                  value={form.major}
                  onChange={(event) => setForm((prev) => ({ ...prev, major: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-900/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                  placeholder="Computer Science, Finance, Medicine..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="englishLevel">
                  English level
                </label>
                <select
                  id="englishLevel"
                  value={form.englishLevel}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, englishLevel: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-900/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
                >
                  <option value="">Choose level (optional)</option>
                  <option value="A1-A2">A1-A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900/15 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f4c5c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create account"}
                  <CheckCircle2 size={16} />
                </button>
              </div>
            </>
          )}
        </form>

        {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0f4c5c] hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      <section className="panel hidden rounded-3xl p-8 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Why users register</p>
        <h2 className="mt-3 text-4xl leading-tight">
          One account for translation, storage, and practice.
        </h2>

        <div className="mt-8 space-y-4">
          <article className="rounded-2xl border border-slate-900/10 bg-white/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserRoundPlus size={16} className="text-[#0f4c5c]" />
              Personal profile
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Tailor vocabulary flow by major and current English level.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-900/10 bg-white/70 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CalendarDays size={16} className="text-[#ff7f50]" />
              Daily routine
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Keep your review cycle active and grow streak over time.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};
