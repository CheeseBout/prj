import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Flame,
  Languages,
  ScanSearch,
  Sparkles,
} from "lucide-react";

const featureCards = [
  {
    icon: ScanSearch,
    title: "Context-first translation",
    description:
      "Detect difficult words directly inside source text and explain them with domain-aware meaning.",
  },
  {
    icon: Languages,
    title: "EN-VI bilingual explanations",
    description:
      "Each term returns concise English explanation and Vietnamese interpretation in one view.",
  },
  {
    icon: BrainCircuit,
    title: "SM-2 smart practice",
    description:
      "Words move through unseen, learning, and mastered with spaced repetition scheduling.",
  },
  {
    icon: Flame,
    title: "Daily momentum",
    description:
      "Streak and progress widgets keep learners consistent without adding extra friction.",
  },
];

const flowSteps = [
  "Scan article or document",
  "Save contextual vocabulary",
  "Review with flashcard or quiz",
  "Track mastery on dashboard",
];

export default function HomePage() {
  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[rgba(255,253,248,0.85)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f4c5c] text-white">
              <Languages size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0f4c5c]">
                LexiBridge
              </p>
              <p className="text-xs text-slate-500">Context Learning Assistant</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-slate-900/15 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-[#0f4c5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#006d77]"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-14 pt-14 md:grid-cols-[1.2fr_0.8fr] md:px-6 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f4c5c]">
              <Sparkles size={14} />
              Designed for EN-VI learners
            </span>
            <h1 className="mt-5 text-4xl leading-tight md:text-6xl">
              Translate with context.
              <br />
              Learn with memory science.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
              LexiBridge helps Vietnamese learners read English materials faster, save useful
              vocabulary, and review with spaced repetition in one seamless flow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff7f50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ff9d77]"
              >
                Create account
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-900/15 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
              >
                View overview
              </Link>
            </div>
          </div>

          <div className="panel rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Product snapshot
            </p>
            <div className="mt-4 rounded-2xl bg-[#0f4c5c] p-5 text-white">
              <p className="text-sm text-white/80">Current context</p>
              <p className="mt-2 text-lg font-semibold leading-snug">
                &ldquo;Probabilistic forecast quality&rdquo;
              </p>
              <div className="mt-4 rounded-xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/75">Vietnamese meaning</p>
                <p className="mt-1 text-sm">Do chat du bao xac suat</p>
              </div>
              <div className="mt-3 rounded-xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-white/75">EN explanation</p>
                <p className="mt-1 text-sm">
                  Measures how well a model predicts uncertain outcomes.
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              {flowSteps.map((step, idx) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/10 text-xs font-semibold">
                    {idx + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="panel rounded-3xl p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e2f2f4] text-[#0f4c5c]">
                    <Icon size={20} />
                  </span>
                  <h2 className="mt-4 text-2xl">{card.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
          <div className="panel rounded-3xl p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Built for academic reading
                </p>
                <h3 className="mt-2 text-3xl md:text-4xl">
                  Move from &ldquo;translate quickly&rdquo; to &ldquo;remember deeply&rdquo;
                </h3>
                <p className="mt-4 max-w-2xl text-sm text-slate-600 md:text-base">
                  Landing, auth, overview, vocabulary hub, and practice room are now aligned in one
                  visual system so your app feels like one product from first login to daily review.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <span className="rounded-full bg-[#0f4c5c] px-4 py-2 text-xs font-semibold text-white">
                  Landing
                </span>
                <span className="rounded-full bg-[#006d77] px-4 py-2 text-xs font-semibold text-white">
                  Dashboard
                </span>
                <span className="rounded-full bg-[#ff7f50] px-4 py-2 text-xs font-semibold text-white">
                  Practice
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900/10 bg-white/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 text-sm text-slate-500 md:px-6">
          <p>LexiBridge</p>
          <p>EN-VI Contextual Learning Platform</p>
        </div>
      </footer>
    </div>
  );
}
