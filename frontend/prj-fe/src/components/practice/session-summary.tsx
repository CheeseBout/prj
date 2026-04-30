"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";

import {
  CardResult,
  formatDuration,
  qualityChoices,
} from "./practice-shared";

interface Props {
  results: CardResult[];
  startTime: number;
  onRestart: () => void;
}

export const SessionSummary = ({ results, startTime, onRestart }: Props) => {
  const avgQuality =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.quality, 0) / results.length
      : 0;

  const qualityCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    results.forEach((r) => counts[r.quality]++);
    return counts;
  }, [results]);

  const masteredCount = results.filter(
    (r) => r.response.new_status === "mastered"
  ).length;

  const duration = Date.now() - startTime;

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Hero */}
      <div className="border border-foreground/10 bg-white p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <Trophy size={48} className="mx-auto text-accent" strokeWidth={1.5} />
        </motion.div>
        <h2 className="mt-5 font-serif text-3xl">
          Session <em className="italic">Complete!</em>
        </h2>
        <p className="mt-2 text-sm text-foreground/50">
          You&apos;ve reviewed all due flashcards. Great work!
        </p>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          { icon: <BookOpen size={16} />, label: "Reviewed", value: results.length },
          { icon: <BarChart3 size={16} />, label: "Avg Quality", value: avgQuality.toFixed(1) },
          { icon: <Award size={16} />, label: "Mastered", value: masteredCount },
          { icon: <Zap size={16} />, label: "Duration", value: formatDuration(duration) },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="border border-foreground/10 bg-white px-4 py-5 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
          >
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
              {stat.icon}
            </div>
            <p className="font-serif text-xl font-bold">{stat.value}</p>
            <p className="editorial-meta mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quality breakdown */}
      <motion.div
        className="mt-4 border border-foreground/10 bg-white p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <p className="editorial-meta mb-4">Quality breakdown</p>
        <div className="space-y-2.5">
          {qualityChoices.map((choice) => {
            const count = qualityCounts[choice.quality];
            const pct = results.length > 0 ? (count / results.length) * 100 : 0;
            return (
              <div key={choice.quality} className="flex items-center gap-3">
                <span className="w-28 text-xs font-semibold shrink-0" style={{ color: choice.color }}>
                  {choice.label}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.05]">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: choice.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.7 + choice.quality * 0.06, ease: "easeOut" }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-bold text-foreground/60">{count}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Word list */}
      {results.length > 0 && (
        <motion.div
          className="mt-4 border border-foreground/10 bg-white p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="editorial-meta mb-4">Words reviewed</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {results.map((r, i) => {
              const qc = qualityChoices[r.quality];
              return (
                <div
                  key={`${r.word}-${i}`}
                  className="flex items-center justify-between rounded px-3 py-2 text-sm transition hover:bg-foreground/[0.03]"
                >
                  <span className="font-medium">{r.word}</span>
                  <div className="flex items-center gap-3">
                    {r.response.new_status === "mastered" && (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    )}
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ color: qc?.color, backgroundColor: qc?.bgHover }}
                    >
                      {r.quality}
                    </span>
                    <span className="text-xs text-foreground/40">
                      +{r.response.interval_days ?? 0}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Restart */}
      <motion.div className="mt-6 flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <button
          type="button"
          onClick={onRestart}
          className="group inline-flex items-center gap-2.5 bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/85"
        >
          <RotateCcw size={15} className="transition group-hover:-rotate-180" style={{ transitionDuration: "500ms" }} />
          Start new session
        </button>
      </motion.div>
    </motion.div>
  );
};
