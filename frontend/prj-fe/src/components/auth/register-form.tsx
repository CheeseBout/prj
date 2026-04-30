"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

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
    if (
      !form.fullName ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
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
    <div className="flex min-h-screen">
      {/* ── Left Panel (Branding) ─────────────────────────────── */}
      <div className="hidden flex-1 flex-col justify-between border-r border-foreground/10 bg-white p-12 lg:flex">
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
            One account for
            <br />
            <em className="italic">translation,</em> storage,
            <br />& <span className="text-accent">practice.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/50">
            Tailor your vocabulary flow by major and current English level.
            Everything syncs across browser extension and dashboard.
          </p>
        </div>

        <p className="relative z-10 text-xs text-foreground/30">
          EN-VI Contextual Learning Platform
        </p>
      </div>

      {/* ── Right Panel (Form) ────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="absolute left-8 top-8 lg:hidden">
          <span className="font-serif text-lg font-bold">
            Lexi<span className="text-accent">Bridge</span>
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <p className="editorial-meta text-accent">Create account</p>
          <h2 className="mt-3 font-serif text-4xl">
            Join LexiBridge<em className="italic">.</em>
          </h2>
          <p className="mt-2 text-sm text-foreground/50">
            Build your personalized learning workspace.
          </p>

          {/* Step indicator */}
          <div className="mt-8 flex items-center gap-2">
            <div
              className={`h-1 rounded-full transition-all ${
                step === 1 ? "w-12 bg-foreground" : "w-5 bg-foreground/15"
              }`}
            />
            <div
              className={`h-1 rounded-full transition-all ${
                step === 2 ? "w-12 bg-foreground" : "w-5 bg-foreground/15"
              }`}
            />
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {step === 1 && (
              <>
                <div>
                  <label
                    className="editorial-meta mb-3 block text-foreground/60"
                    htmlFor="register-fullName"
                  >
                    Full name
                  </label>
                  <input
                    id="register-fullName"
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        fullName: event.target.value,
                      }))
                    }
                    className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                    placeholder="Nguyen Van A"
                  />
                </div>

                <div>
                  <label
                    className="editorial-meta mb-3 block text-foreground/60"
                    htmlFor="register-email"
                  >
                    Email
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      className="editorial-meta mb-3 block text-foreground/60"
                      htmlFor="register-password"
                    >
                      Password
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                      placeholder="At least 8 chars"
                    />
                  </div>
                  <div>
                    <label
                      className="editorial-meta mb-3 block text-foreground/60"
                      htmlFor="register-confirmPassword"
                    >
                      Confirm
                    </label>
                    <input
                      id="register-confirmPassword"
                      type="password"
                      required
                      minLength={8}
                      value={form.confirmPassword}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }))
                      }
                      className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={gotoStepTwo}
                  className="group inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/85"
                >
                  Continue
                  <ArrowRight
                    size={15}
                    className="transition group-hover:translate-x-0.5"
                  />
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      className="editorial-meta mb-3 block text-foreground/60"
                      htmlFor="register-dob"
                    >
                      Date of birth
                    </label>
                    <input
                      id="register-dob"
                      type="date"
                      value={form.dob}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          dob: event.target.value,
                        }))
                      }
                      className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                    />
                  </div>
                  <div>
                    <label
                      className="editorial-meta mb-3 block text-foreground/60"
                      htmlFor="register-gender"
                    >
                      Gender
                    </label>
                    <select
                      id="register-gender"
                      value={form.gender ? "male" : "female"}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          gender: event.target.value === "male",
                        }))
                      }
                      className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    className="editorial-meta mb-3 block text-foreground/60"
                    htmlFor="register-major"
                  >
                    Major
                  </label>
                  <input
                    id="register-major"
                    type="text"
                    value={form.major}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        major: event.target.value,
                      }))
                    }
                    className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
                    placeholder="Computer Science, Finance, Medicine..."
                  />
                </div>

                <div>
                  <label
                    className="editorial-meta mb-3 block text-foreground/60"
                    htmlFor="register-englishLevel"
                  >
                    English level
                  </label>
                  <select
                    id="register-englishLevel"
                    value={form.englishLevel}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        englishLevel: event.target.value,
                      }))
                    }
                    className="w-full border-b border-foreground/15 bg-transparent pb-3 text-sm outline-none transition focus:border-accent"
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
                    className="inline-flex w-full items-center justify-center gap-2 border border-foreground/15 px-4 py-3.5 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
                  >
                    <ArrowLeft size={15} />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating..." : "Create account"}
                    <CheckCircle2 size={15} />
                  </button>
                </div>
              </>
            )}
          </form>

          {error && (
            <div className="mt-5 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="mt-8 text-sm text-foreground/50">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-4 transition hover:decoration-accent"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
