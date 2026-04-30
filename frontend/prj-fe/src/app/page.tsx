"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Languages,
  ScanSearch,
  Flame,
} from "lucide-react";

const featureCards = [
  {
    icon: ScanSearch,
    meta: "Translation",
    title: "Context-first translation",
    description:
      "Detect difficult words directly inside source text and explain them with domain-aware meaning.",
  },
  {
    icon: Languages,
    meta: "Bilingual",
    title: "EN-VI bilingual explanations",
    description:
      "Each term returns concise English explanation and Vietnamese interpretation in one view.",
  },
  {
    icon: BrainCircuit,
    meta: "Memory",
    title: "SM-2 smart practice",
    description:
      "Words move through unseen, learning, and mastered with spaced repetition scheduling.",
  },
  {
    icon: Flame,
    meta: "Momentum",
    title: "Daily momentum",
    description:
      "Streak and progress widgets keep learners consistent without adding extra friction.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-20 border-b border-foreground/10 bg-[rgba(250,249,246,0.85)] backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-tight">
              Lexi<span className="text-accent">Bridge</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-foreground/60 transition hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:bg-foreground/85"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center px-6 pb-32 pt-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-4xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/50">
              <Languages size={14} className="text-accent" />
              Designed for EN-VI learners
            </span>

            <h1 className="mt-8 font-serif text-5xl leading-[1.1] md:text-7xl">
              Translate with <em className="italic">context.</em>
              <br />
              Learn with{" "}
              <span className="text-accent">memory science.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-foreground/55">
              LexiBridge helps Vietnamese learners read English materials faster,
              save useful vocabulary, and review with spaced repetition — all in
              one seamless flow.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-sm bg-accent px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#d04f00]"
              >
                Create account
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 border border-foreground/15 px-8 py-3.5 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
              >
                View overview
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ── Feature Section ────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl border-t border-foreground/10 px-6 py-20">
          <div className="grid gap-0 md:grid-cols-2">
            {featureCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.article
                  key={card.title}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={fadeUp}
                  className={`flex flex-col gap-4 border-foreground/10 p-10 ${
                    index % 2 === 0 ? "md:border-r" : ""
                  } ${index < 2 ? "border-b" : ""}`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10">
                    <Icon size={20} className="text-accent" />
                  </span>
                  <p className="editorial-meta">{card.meta}</p>
                  <h3 className="font-serif text-2xl">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground/55">
                    {card.description}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* ── CTA Section ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="border border-foreground/10 p-10 md:p-16">
            <p className="editorial-meta">Built for academic reading</p>
            <h2 className="mt-4 font-serif text-3xl md:text-5xl">
              Move from &ldquo;<em className="italic">translate quickly</em>
              &rdquo; to &ldquo;
              <em className="italic">remember deeply</em>&rdquo;
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-foreground/55 md:text-base">
              Landing, auth, overview, vocabulary hub, and practice room are now
              aligned in one visual system so your app feels like one product
              from first login to daily review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
                Landing
              </span>
              <span className="rounded-full bg-foreground/80 px-4 py-2 text-xs font-semibold text-background">
                Dashboard
              </span>
              <span className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
                Practice
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="h-16 border-t border-foreground/10">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-sm text-foreground/40">
          <p className="font-serif">LexiBridge</p>
          <p>EN-VI Contextual Learning Platform</p>
        </div>
      </footer>
    </div>
  );
}
