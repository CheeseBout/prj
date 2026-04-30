"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Tag, X } from "lucide-react";

import {
  QuizQuestion,
  updateVocabProgress,
} from "@/lib/api";

import {
  CardResult,
  getSpecColor,
  getSpecDisplayName,
} from "./practice-shared";

interface Props {
  questions: QuizQuestion[];
  onFinish: (results: CardResult[]) => void;
}

export const QuizMode = ({ questions, onFinish }: Props) => {
  const [qIndex, setQIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);

  const totalCount = questions.length;
  const current = qIndex < totalCount ? questions[qIndex] : null;
  const progressPct = totalCount > 0 ? (results.length / totalCount) * 100 : 0;

  const handleChoiceSelect = async (choiceIdx: number) => {
    if (isRevealed || isUpdating || !current) return;
    setSelectedIdx(choiceIdx);
    setIsRevealed(true);
    setError(null);

    const isCorrect = choiceIdx === current.correct_index;
    const quality = isCorrect ? 4 : 1;

    setIsUpdating(true);
    try {
      const result = await updateVocabProgress({
        word: current.word,
        quality,
        context: current.context,
        translation: current.translation,
      });
      const newResults = [...results, { word: current.word, quality, response: result }];
      setResults(newResults);

      // Auto-advance after delay
      setTimeout(() => {
        if (qIndex >= totalCount - 1) {
          onFinish(newResults);
        } else {
          setQIndex((p) => p + 1);
          setSelectedIdx(null);
          setIsRevealed(false);
        }
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!current) {
    return <p className="editorial-meta text-foreground/40">No quiz questions available.</p>;
  }

  const isEnToVi = current.quiz_type === "en_to_vi";
  const specCol = getSpecColor(current.specialization);

  return (
    <div className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="editorial-meta">Progress — {results.length} / {totalCount}</span>
          <span className="text-xs font-semibold text-accent">{Math.round(progressPct)}%</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "linear-gradient(90deg, #E85D04, #f59e0b)" }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          className="border border-foreground/10 bg-white p-10"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* Badge row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {current.specialization && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: specCol.bg, color: specCol.text, borderColor: specCol.border }}
                >
                  <Tag size={11} />
                  {getSpecDisplayName(current.specialization)}
                </span>
              )}
            </div>
            <span className="editorial-meta">{qIndex + 1} / {totalCount}</span>
          </div>

          {/* Prompt */}
          <p className="editorial-meta text-accent mb-2">
            {isEnToVi ? "What is the Vietnamese meaning of:" : "Which English term matches:"}
          </p>
          <h2 className="font-serif text-4xl mb-2">
            {isEnToVi ? current.word : current.translation}
          </h2>

          {/* Context hint */}
          {current.context && (
            <p className="text-sm text-foreground/40 mt-2 mb-8 max-w-lg leading-relaxed">
              &ldquo;{current.context}&rdquo;
            </p>
          )}

          {/* Choices */}
          <div className="grid grid-cols-1 gap-3 mt-6">
            {current.choices.map((choice, idx) => {
              const isCorrectChoice = idx === current.correct_index;
              const isSelected = selectedIdx === idx;

              let borderColor = "border-foreground/10";
              let bgColor = "bg-white";
              let textColor = "text-foreground";

              if (isRevealed) {
                if (isCorrectChoice) {
                  borderColor = "border-emerald-400";
                  bgColor = "bg-emerald-50";
                  textColor = "text-emerald-700";
                } else if (isSelected && !isCorrectChoice) {
                  borderColor = "border-red-400";
                  bgColor = "bg-red-50";
                  textColor = "text-red-700";
                } else {
                  textColor = "text-foreground/30";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => void handleChoiceSelect(idx)}
                  className={`flex items-center gap-3 border ${borderColor} ${bgColor} ${textColor} px-5 py-4 text-left text-sm font-medium transition hover:bg-foreground/[0.03] disabled:cursor-default`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{choice}</span>
                  {isRevealed && isCorrectChoice && <Check size={18} className="text-emerald-500" />}
                  {isRevealed && isSelected && !isCorrectChoice && <X size={18} className="text-red-500" />}
                </button>
              );
            })}
          </div>

          {/* Explanation on reveal */}
          {isRevealed && (current.en_explanation || current.vi_explanation) && (
            <motion.div
              className="mt-6 space-y-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {current.en_explanation && (
                <div className="rounded border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1">English</p>
                  <p className="text-sm leading-relaxed text-foreground/70">{current.en_explanation}</p>
                </div>
              )}
              {current.vi_explanation && (
                <div className="rounded border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1">Tiếng Việt</p>
                  <p className="text-sm leading-relaxed text-foreground/70">{current.vi_explanation}</p>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
