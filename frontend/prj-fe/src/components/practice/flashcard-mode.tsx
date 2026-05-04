"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Keyboard,
  RotateCcw,
  Sparkles,
  Tag,
  TimerReset,
  Zap,
} from "lucide-react";

import { VocabItem } from "@/lib/api";

import {
  CardResult,
  difficultyColorMap,
  getSpecColor,
  getSpecDisplayName,
} from "./practice-shared";

interface Props {
  practiceList: VocabItem[];
  onFinish: (results: CardResult[]) => void;
}

const getDifficultyIcon = (difficulty?: string) => {
  const normalized = difficulty?.toLowerCase();
  if (normalized === "basic") return <Sparkles size={11} />;
  if (normalized === "intermediate") return <Zap size={11} />;
  return <BrainCircuit size={11} />;
};

export const FlashcardMode = ({ practiceList, onFinish }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);

  const totalCount = practiceList.length;
  const currentWord = currentIndex < totalCount ? practiceList[currentIndex] : null;
  const reviewedCount = results.length;
  const remainingCount = Math.max(totalCount - reviewedCount, 0);
  const progressPct = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;
  const clampedProgressPct = Math.min(Math.max(progressPct, 0), 100);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, totalCount]);

  const markCurrentReviewed = useCallback(() => {
    if (!currentWord) return results;

    if (results.some((result) => result.word === currentWord.word)) {
      return results;
    }

    const updated = [
      ...results,
      {
        word: currentWord.word,
        quality: 3,
        response: {
          status: "simulated",
          new_status: currentWord.status,
          interval_days: 0,
        },
      },
    ];

    setResults(updated);
    return updated;
  }, [currentWord, results]);

  const handleReviewedAndContinue = useCallback(() => {
    if (!currentWord) return;

    const updated = markCurrentReviewed();
    if (currentIndex >= totalCount - 1) {
      onFinish(updated);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setIsFlipped(false);
  }, [currentWord, markCurrentReviewed, currentIndex, totalCount, onFinish]);

  const handleFinishNow = useCallback(() => {
    const updated = markCurrentReviewed();
    onFinish(updated);
  }, [markCurrentReviewed, onFinish]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!currentWord) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        handleFlip();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }

      if (isFlipped && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleReviewedAndContinue();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [currentWord, isFlipped, handleFlip, goBack, goNext, handleReviewedAndContinue]);

  const completionTrack = useMemo(() => {
    return practiceList.map((item, index) => {
      const isCurrent = index === currentIndex;
      const isDone = results.some((result) => result.word === item.word);
      return { key: `${item.word}-${index}`, isCurrent, isDone };
    });
  }, [practiceList, currentIndex, results]);

  if (!currentWord) {
    return (
      <div className="space-y-6 text-center">
        <BrainCircuit size={40} className="mx-auto text-foreground/20" />
        <p className="font-serif text-2xl text-foreground/40">No saved words found.</p>
      </div>
    );
  }

  const currentReviewed = results.some((result) => result.word === currentWord.word);
  const specCol = getSpecColor(currentWord.specialization);
  const diffColor = currentWord.difficulty
    ? difficultyColorMap[currentWord.difficulty.toLowerCase()]
    : undefined;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-5 border border-foreground/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="editorial-meta">Flashcard Session</p>
            <p className="mt-1 text-sm text-foreground/55">
              {reviewedCount} reviewed - {remainingCount} remaining
            </p>
          </div>
          <div className="inline-flex items-center gap-2 border border-foreground/10 bg-foreground/[0.02] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-foreground/45">
            <Keyboard size={13} />
            Space/Enter flip - N reviewed
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-foreground/40">Progress</span>
          <span className="font-semibold text-accent">{Math.round(clampedProgressPct)}%</span>
        </div>
        <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(90deg, #E85D04, #f59e0b)" }}
            initial={{ width: 0 }}
            animate={{ width: `${clampedProgressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {completionTrack.map((slot) => (
            <span
              key={slot.key}
              className={`h-1.5 w-5 rounded-full transition ${
                slot.isCurrent
                  ? "bg-accent"
                  : slot.isDone
                  ? "bg-foreground/45"
                  : "bg-foreground/12"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative h-[31rem] md:h-[32rem]" style={{ perspective: 1000 }}>
        <motion.div
          key={`${currentWord.word}-${currentIndex}`}
          className="absolute inset-0"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0 flex flex-col border border-foreground/10 bg-white p-6 md:p-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {currentWord.specialization && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: specCol.bg,
                      color: specCol.text,
                      borderColor: specCol.border,
                    }}
                  >
                    <Tag size={11} />
                    {getSpecDisplayName(currentWord.specialization)}
                  </span>
                )}
                {currentWord.difficulty && diffColor && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2.5 py-1 text-[11px] font-semibold"
                    style={{ color: diffColor }}
                  >
                    {getDifficultyIcon(currentWord.difficulty)}
                    {currentWord.difficulty}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-foreground/40">
                {currentIndex + 1} / {totalCount}
              </span>
            </div>

            <div className="mt-8 text-center">
              <p className="editorial-meta text-accent">Word Card</p>
              <h2 className="mt-4 break-words font-serif text-4xl md:text-5xl">
                {currentWord.word}
              </h2>
            </div>

            {currentWord.tags && currentWord.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-1.5">
                {currentWord.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-foreground/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t border-foreground/10 pt-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/35">
                <TimerReset size={13} />
                Tap flip or press Space
              </span>
              <button
                type="button"
                onClick={handleFlip}
                className="inline-flex items-center gap-2 rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#d04f00]"
              >
                <RotateCcw size={13} />
                Reveal answer
              </button>
            </div>
          </div>

          <div
            className="absolute inset-0 flex flex-col border border-foreground/10 bg-foreground p-6 text-background md:p-8"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="text-center">
              <p className="editorial-meta text-background/50">Vietnamese Meaning</p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                {currentWord.translation || "No translation"}
              </h2>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="rounded border border-background/10 bg-background/5 px-4 py-3 text-left">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-background/40">
                    English Explanation
                  </p>
                  <p className="text-sm leading-relaxed text-background/80">
                    {currentWord.en_explanation || "No English explanation available."}
                  </p>
                </div>

                <div className="rounded border border-background/10 bg-background/5 px-4 py-3 text-left">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-background/40">
                    Vietnamese Explanation
                  </p>
                  <p className="text-sm leading-relaxed text-background/80">
                    {currentWord.vi_explanation || "No Vietnamese explanation available."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleReviewedAndContinue}
                className="flex w-full items-center justify-center gap-2 border border-emerald-400/60 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              >
                <CheckCircle2 size={16} />
                {currentReviewed
                  ? currentIndex >= totalCount - 1
                    ? "Finish session"
                    : "Go next"
                  : currentIndex >= totalCount - 1
                  ? "Mark reviewed & finish"
                  : "Mark reviewed & next"}
              </button>

              {currentIndex >= totalCount - 1 && (
                <button
                  type="button"
                  onClick={handleFinishNow}
                  className="w-full border border-background/20 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-background/75 transition hover:bg-background/10"
                >
                  Finish now
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={currentIndex === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30"
          aria-label="Previous card"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={handleFlip}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white transition hover:bg-[#d04f00]"
          aria-label="Flip card"
        >
          <RotateCcw size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex >= totalCount - 1}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30"
          aria-label="Next card"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
