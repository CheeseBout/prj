"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Tag,
  Trophy,
  Zap,
} from "lucide-react";

import {
  getPracticeList,
  ProgressUpdateResponse,
  updateVocabProgress,
  VocabItem,
} from "@/lib/api";

/* ── SM-2 quality choices ──────────────────────────────────────── */

const qualityChoices: Array<{
  quality: number;
  label: string;
  color: string;
  bgHover: string;
}> = [
  { quality: 0, label: "Forgot", color: "#dc2626", bgHover: "rgba(220,38,38,0.15)" },
  { quality: 1, label: "Wrong, vague", color: "#ea580c", bgHover: "rgba(234,88,12,0.15)" },
  { quality: 2, label: "Wrong, recalled", color: "#ca8a04", bgHover: "rgba(202,138,4,0.15)" },
  { quality: 3, label: "Correct, hard", color: "#2563eb", bgHover: "rgba(37,99,235,0.15)" },
  { quality: 4, label: "Correct, good", color: "#16a34a", bgHover: "rgba(22,163,74,0.15)" },
  { quality: 5, label: "Very easy", color: "#059669", bgHover: "rgba(5,150,105,0.15)" },
];

/* ── Specialization badge color map ────────────────────────────── */

const specColors: Record<string, { bg: string; text: string; border: string }> = {
  "Computer Science": { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "Medicine": { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  "Law": { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  "Business": { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  "Engineering": { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  "Science": { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  "Linguistics": { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
};

const defaultSpecColor = { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };

const difficultyConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  easy: { icon: <Sparkles size={11} />, color: "#16a34a" },
  medium: { icon: <Zap size={11} />, color: "#ca8a04" },
  hard: { icon: <BrainCircuit size={11} />, color: "#dc2626" },
};

/* ── Session result per card ───────────────────────────────────── */

interface CardResult {
  word: string;
  quality: number;
  response: ProgressUpdateResponse;
}

/* ── Component ─────────────────────────────────────────────────── */

export const PracticeClient = () => {
  const [practiceList, setPracticeList] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastResult, setLastResult] = useState<ProgressUpdateResponse | null>(
    null
  );

  // Session tracking
  const [sessionResults, setSessionResults] = useState<CardResult[]>([]);
  const [sessionFinished, setSessionFinished] = useState(false);
  const sessionStartTime = useRef<number>(Date.now());

  const loadPracticeList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setLastResult(null);
    setSessionResults([]);
    setSessionFinished(false);
    sessionStartTime.current = Date.now();

    try {
      const response = await getPracticeList();
      setPracticeList(response.data ?? []);
    } catch (loadError: unknown) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Could not load practice list.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPracticeList();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPracticeList]);

  const currentWord = useMemo(
    () =>
      currentIndex < practiceList.length ? practiceList[currentIndex] : null,
    [currentIndex, practiceList]
  );

  const totalCount = practiceList.length;
  const reviewedCount = sessionResults.length;
  const progressPct = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;

  const handleFlip = () => setIsFlipped((prev) => !prev);

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setLastResult(null);
    }
  };

  const goNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setLastResult(null);
    }
  };

  const handleQualitySelect = async (quality: number) => {
    if (!currentWord) return;

    setIsUpdating(true);
    setError(null);
    try {
      const result = await updateVocabProgress({
        word: currentWord.word,
        quality,
        context: currentWord.context,
        translation: currentWord.translation,
      });

      setLastResult(result);
      setSessionResults((prev) => [
        ...prev,
        { word: currentWord.word, quality, response: result },
      ]);

      // If this was the last card, show the session summary
      if (currentIndex >= totalCount - 1) {
        setSessionFinished(true);
      } else {
        setIsFlipped(false);
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (updateError: unknown) {
      if (updateError instanceof Error) {
        setError(updateError.message);
      } else {
        setError("Failed to update progress.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  /* ── Helpers ───────────────────────────────────────────────── */

  const getSpecColor = (spec?: string) => {
    if (!spec) return defaultSpecColor;
    return specColors[spec] ?? defaultSpecColor;
  };

  const getDiffConfig = (diff?: string) => {
    if (!diff) return null;
    return difficultyConfig[diff.toLowerCase()] ?? null;
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return `${sec}s`;
    return `${min}m ${sec}s`;
  };

  /* ── Session Summary ────────────────────────────────────────── */

  const avgQuality =
    sessionResults.length > 0
      ? sessionResults.reduce((sum, r) => sum + r.quality, 0) /
        sessionResults.length
      : 0;

  const qualityCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    sessionResults.forEach((r) => {
      counts[r.quality]++;
    });
    return counts;
  }, [sessionResults]);

  const masteredCount = sessionResults.filter(
    (r) => r.response.new_status === "mastered"
  ).length;

  const sessionDuration = Date.now() - sessionStartTime.current;

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-foreground/10 pb-6">
        <div>
          <p className="editorial-meta">Practice room</p>
          <h1 className="mt-2 font-serif text-3xl">
            SM-2 <em className="italic">Flashcards.</em>
          </h1>
        </div>
        <div className="text-right">
          <p className="font-serif text-4xl font-bold text-foreground/15">
            {String(Math.min(currentIndex + 1, totalCount)).padStart(2, "0")}
          </p>
          <p className="editorial-meta">
            of {String(totalCount).padStart(2, "0")}
          </p>
        </div>
      </header>

      {/* ── Progress Bar ──────────────────────────────────────────── */}
      {totalCount > 0 && !sessionFinished && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="editorial-meta">
              Progress — {reviewedCount} / {totalCount} reviewed
            </span>
            <span className="text-xs font-semibold text-accent">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, #E85D04, #f59e0b)",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lastResult?.next_review_date && !sessionFinished && (
        <div className="mt-4 border-l-2 border-accent bg-[#fdf6f0] px-4 py-3 text-sm text-foreground/70">
          <p className="font-semibold text-accent">SM-2 updated</p>
          <p className="mt-1">
            Rep: {lastResult.repetitions ?? "-"} | Interval:{" "}
            {lastResult.interval_days ?? "-"} days | EF:{" "}
            {typeof lastResult.ease_factor === "number"
              ? lastResult.ease_factor.toFixed(2)
              : "-"}
          </p>
          <p className="mt-1">
            Next review:{" "}
            {new Date(lastResult.next_review_date).toLocaleString()}
          </p>
        </div>
      )}

      {/* ── Flashcard Stage ─────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-foreground/[0.02]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.p
              key="loading"
              className="editorial-meta animate-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Loading due words...
            </motion.p>
          ) : sessionFinished && sessionResults.length > 0 ? (
            /* ── SESSION SUMMARY ─────────────────────────────────── */
            <motion.div
              key="summary"
              className="w-full max-w-2xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Hero section */}
              <div className="border border-foreground/10 bg-white p-10 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2,
                  }}
                >
                  <Trophy
                    size={48}
                    className="mx-auto text-accent"
                    strokeWidth={1.5}
                  />
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
                  {
                    icon: <BookOpen size={16} />,
                    label: "Reviewed",
                    value: sessionResults.length,
                  },
                  {
                    icon: <BarChart3 size={16} />,
                    label: "Avg Quality",
                    value: avgQuality.toFixed(1),
                  },
                  {
                    icon: <Award size={16} />,
                    label: "Mastered",
                    value: masteredCount,
                  },
                  {
                    icon: <Zap size={16} />,
                    label: "Duration",
                    value: formatDuration(sessionDuration),
                  },
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
                    const pct =
                      sessionResults.length > 0
                        ? (count / sessionResults.length) * 100
                        : 0;
                    return (
                      <div key={choice.quality} className="flex items-center gap-3">
                        <span
                          className="w-28 text-xs font-semibold shrink-0"
                          style={{ color: choice.color }}
                        >
                          {choice.label}
                        </span>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.05]">
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ backgroundColor: choice.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.7 + choice.quality * 0.06,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-bold text-foreground/60">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Word list detail */}
              {sessionResults.length > 0 && (
                <motion.div
                  className="mt-4 border border-foreground/10 bg-white p-6"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <p className="editorial-meta mb-4">Words reviewed</p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {sessionResults.map((r, i) => {
                      const qc = qualityChoices[r.quality];
                      return (
                        <div
                          key={`${r.word}-${i}`}
                          className="flex items-center justify-between rounded px-3 py-2 text-sm transition hover:bg-foreground/[0.03]"
                        >
                          <span className="font-medium">{r.word}</span>
                          <div className="flex items-center gap-3">
                            {r.response.new_status === "mastered" && (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500"
                              />
                            )}
                            <span
                              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                              style={{
                                color: qc?.color,
                                backgroundColor: qc?.bgHover,
                              }}
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

              {/* Restart button */}
              <motion.div
                className="mt-6 flex justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <button
                  type="button"
                  onClick={() => void loadPracticeList()}
                  className="group inline-flex items-center gap-2.5 bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition hover:bg-foreground/85"
                >
                  <RotateCcw
                    size={15}
                    className="transition group-hover:-rotate-180"
                    style={{ transitionDuration: "500ms" }}
                  />
                  Start new session
                </button>
              </motion.div>
            </motion.div>
          ) : !currentWord ? (
            <motion.div
              key="empty"
              className="space-y-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <BrainCircuit size={40} className="mx-auto text-foreground/20" />
              <p className="font-serif text-2xl text-foreground/40">
                No words due for review.
              </p>
              <button
                type="button"
                onClick={() => void loadPracticeList()}
                className="group inline-flex items-center gap-2 bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/85"
              >
                <RotateCcw size={15} />
                Reload list
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              className="w-full max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* 3D Card */}
              <div className="relative h-[28rem]" style={{ perspective: 1000 }}>
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotateX: isFlipped ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Front face */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center border border-foreground/10 bg-white p-10 text-center"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    {/* ── Specialization & Difficulty Badges ──────── */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {currentWord.specialization && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: getSpecColor(
                              currentWord.specialization
                            ).bg,
                            color: getSpecColor(currentWord.specialization)
                              .text,
                            borderColor: getSpecColor(
                              currentWord.specialization
                            ).border,
                          }}
                        >
                          <Tag size={11} />
                          {currentWord.specialization}
                        </span>
                      )}
                      {currentWord.difficulty &&
                        getDiffConfig(currentWord.difficulty) && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              color: getDiffConfig(currentWord.difficulty)!
                                .color,
                            }}
                          >
                            {getDiffConfig(currentWord.difficulty)!.icon}
                            {currentWord.difficulty}
                          </span>
                        )}
                    </div>

                    <p className="editorial-meta text-accent mt-4">
                      Word #{currentIndex + 1}
                    </p>
                    <h2 className="mt-5 font-serif text-5xl">
                      {currentWord.word}
                    </h2>
                    <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/45">
                      {currentWord.context || "No context available."}
                    </p>
                    <p className="mt-8 text-xs text-foreground/25">
                      Tap flip to reveal meaning
                    </p>
                  </div>

                  {/* Back face */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center border border-foreground/10 bg-foreground p-10 text-center text-background"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateX(180deg)",
                    }}
                  >
                    <p className="editorial-meta text-background/50">
                      Vietnamese meaning
                    </p>
                    <h2 className="mt-6 font-serif text-4xl">
                      {currentWord.translation || "No translation"}
                    </h2>

                    {/* Quality buttons on back */}
                    <div className="mt-10 grid w-full max-w-md grid-cols-3 gap-2">
                      {qualityChoices.map((choice) => (
                        <button
                          key={choice.quality}
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            void handleQualitySelect(choice.quality)
                          }
                          className="border border-background/15 px-2 py-2.5 text-xs font-semibold text-background/80 transition hover:bg-background/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {choice.label} ({choice.quality})
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Controls */}
              <div className="mt-12 flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentIndex === 0}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleFlip}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white transition hover:bg-[#d04f00]"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentIndex >= totalCount - 1}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
