"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  RotateCcw,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";

import {
  ProgressUpdateResponse,
  updateVocabProgress,
  VocabItem,
} from "@/lib/api";

import {
  CardResult,
  difficultyColorMap,
  getSpecColor,
  getSpecDisplayName,
  qualityChoices,
} from "./practice-shared";

interface Props {
  practiceList: VocabItem[];
  onFinish: (results: CardResult[]) => void;
}

export const FlashcardMode = ({ practiceList, onFinish }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ProgressUpdateResponse | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);

  const totalCount = practiceList.length;
  const currentWord = currentIndex < totalCount ? practiceList[currentIndex] : null;
  const reviewedCount = results.length;
  const progressPct = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;

  const handleFlip = () => setIsFlipped((p) => !p);

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((p) => p - 1);
      setIsFlipped(false);
      setLastResult(null);
    }
  };

  const goNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((p) => p + 1);
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
      const newResults = [...results, { word: currentWord.word, quality, response: result }];
      setResults(newResults);
      if (currentIndex >= totalCount - 1) {
        onFinish(newResults);
      } else {
        setIsFlipped(false);
        setCurrentIndex((p) => p + 1);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update progress.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!currentWord) {
    return (
      <div className="space-y-6 text-center">
        <BrainCircuit size={40} className="mx-auto text-foreground/20" />
        <p className="font-serif text-2xl text-foreground/40">No words due for review.</p>
      </div>
    );
  }

  const specCol = getSpecColor(currentWord.specialization);
  const diffColor = currentWord.difficulty ? difficultyColorMap[currentWord.difficulty.toLowerCase()] : undefined;

  return (
    <div className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="editorial-meta">Progress — {reviewedCount} / {totalCount} reviewed</span>
          <span className="text-xs font-semibold text-accent">{Math.round(progressPct)}%</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(90deg, #E85D04, #f59e0b)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {lastResult?.next_review_date && (
        <div className="mb-4 border-l-2 border-accent bg-[#fdf6f0] px-4 py-3 text-sm text-foreground/70">
          <p className="font-semibold text-accent">SM-2 updated</p>
          <p className="mt-1">
            Rep: {lastResult.repetitions ?? "-"} | Interval: {lastResult.interval_days ?? "-"} days | EF:{" "}
            {typeof lastResult.ease_factor === "number" ? lastResult.ease_factor.toFixed(2) : "-"}
          </p>
        </div>
      )}

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
            {/* Specialization & Difficulty badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {currentWord.specialization && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: specCol.bg, color: specCol.text, borderColor: specCol.border }}
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
                  {currentWord.difficulty.toLowerCase() === "basic" ? <Sparkles size={11} /> :
                   currentWord.difficulty.toLowerCase() === "intermediate" ? <Zap size={11} /> :
                   <BrainCircuit size={11} />}
                  {currentWord.difficulty}
                </span>
              )}
            </div>

            <p className="editorial-meta text-accent mt-4">Word #{currentIndex + 1}</p>
            <h2 className="mt-5 font-serif text-5xl">{currentWord.word}</h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/45">
              {currentWord.context || "No context available."}
            </p>
            <p className="mt-8 text-xs text-foreground/25">Tap flip to reveal meaning</p>
          </div>

          {/* Back face — Bilingual */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center border border-foreground/10 bg-foreground p-8 text-center text-background overflow-y-auto"
            style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
          >
            {/* Vietnamese translation */}
            <p className="editorial-meta text-background/50">Vietnamese meaning</p>
            <h2 className="mt-3 font-serif text-3xl">{currentWord.translation || "No translation"}</h2>

            {/* Bilingual explanations */}
            {(currentWord.en_explanation || currentWord.vi_explanation) && (
              <div className="mt-5 w-full max-w-md space-y-3">
                {currentWord.en_explanation && (
                  <div className="rounded border border-background/10 bg-background/5 px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mb-1">English</p>
                    <p className="text-sm leading-relaxed text-background/80">{currentWord.en_explanation}</p>
                  </div>
                )}
                {currentWord.vi_explanation && (
                  <div className="rounded border border-background/10 bg-background/5 px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-background/40 mb-1">Tiếng Việt</p>
                    <p className="text-sm leading-relaxed text-background/80">{currentWord.vi_explanation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quality buttons */}
            <div className="mt-5 grid w-full max-w-md grid-cols-3 gap-2">
              {qualityChoices.map((choice) => (
                <button
                  key={choice.quality}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleQualitySelect(choice.quality)}
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
      <div className="mt-10 flex items-center justify-center gap-6">
        <button type="button" onClick={goBack} disabled={currentIndex === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30">
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={handleFlip}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white transition hover:bg-[#d04f00]">
          <RotateCcw size={20} />
        </button>
        <button type="button" onClick={goNext} disabled={currentIndex >= totalCount - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-foreground/10 transition hover:bg-foreground/5 disabled:opacity-30">
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
