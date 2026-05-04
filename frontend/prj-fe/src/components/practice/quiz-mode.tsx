"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Tag, X } from "lucide-react";

import { submitTestAnswer, TestQuestion } from "@/lib/api";

import { CardResult, getSpecColor, getSpecDisplayName } from "./practice-shared";

interface Props {
  questions: TestQuestion[];
  onFinish: (results: CardResult[]) => void;
}

export const QuizMode = ({ questions, onFinish }: Props) => {
  const [qIndex, setQIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [serverExplanation, setServerExplanation] = useState<string | null>(null);

  const totalCount = questions.length;
  const current = qIndex < totalCount ? questions[qIndex] : null;
  const progressPct = totalCount > 0 ? (results.length / totalCount) * 100 : 0;

  const handleChoiceSelect = async (choiceIdx: number) => {
    if (isRevealed || isSubmitting || !current) return;

    setError(null);
    setSelectedIdx(choiceIdx);
    setIsSubmitting(true);

    try {
      const answer = await submitTestAnswer({
        question_id: current.question_id,
        selected_index: choiceIdx,
      });

      setCorrectIndex(answer.correct_index);
      setServerExplanation(answer.explanation_en || null);
      setIsRevealed(true);

      const newResults = [
        ...results,
        {
          word: current.word,
          quality: answer.quality,
          response: {
            status: answer.status,
            new_status: answer.new_status,
            interval_days: answer.interval_days,
            ease_factor: answer.ease_factor,
          },
        },
      ];
      setResults(newResults);

      setTimeout(() => {
        if (qIndex >= totalCount - 1) {
          onFinish(newResults);
        } else {
          setQIndex((prev) => prev + 1);
          setSelectedIdx(null);
          setCorrectIndex(null);
          setServerExplanation(null);
          setIsRevealed(false);
        }
      }, 1300);
    } catch (unknownError: unknown) {
      setError(unknownError instanceof Error ? unknownError.message : "Failed to submit answer.");
      setSelectedIdx(null);
      setCorrectIndex(null);
      setServerExplanation(null);
      setIsRevealed(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!current) {
    return <p className="editorial-meta text-foreground/40">No test questions available.</p>;
  }

  const specCol = getSpecColor(current.specialization);

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-4 border-l-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
        Test mode uses backend question bank + SM-2 scoring.
      </div>

      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="editorial-meta">
            Progress - {results.length} / {totalCount}
          </span>
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
        <div className="mb-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          className="border border-foreground/10 bg-white p-10"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {current.specialization && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor: specCol.bg,
                    color: specCol.text,
                    borderColor: specCol.border,
                  }}
                >
                  <Tag size={11} />
                  {getSpecDisplayName(current.specialization)}
                </span>
              )}
            </div>
            <span className="editorial-meta">
              {qIndex + 1} / {totalCount}
            </span>
          </div>

          <p className="mb-2 editorial-meta text-accent">Choose the best meaning</p>
          <h2 className="mb-2 font-serif text-3xl leading-tight">{current.stem}</h2>

          <div className="mt-6 grid grid-cols-1 gap-3">
            {current.choices.map((choice, idx) => {
              const isCorrectChoice = correctIndex === idx;
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
                  disabled={isRevealed || isSubmitting}
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

          {isRevealed && serverExplanation && (
            <motion.div className="mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rounded border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-left">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                  Explanation
                </p>
                <p className="text-sm leading-relaxed text-foreground/70">{serverExplanation}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
