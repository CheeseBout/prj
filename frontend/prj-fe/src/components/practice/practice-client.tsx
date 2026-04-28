"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  RotateCcw,
  XCircle,
} from "lucide-react";

import {
  getPracticeList,
  ManualTranslateResponse,
  translateManual,
  updateProgress,
  VocabItem,
} from "@/lib/api";

type PracticeMode = "flashcard" | "quiz";
type QuizOption = { label: string; correct: boolean };
type SessionScore = { again: number; hard: number; easy: number };

const getExplanationKey = (item: VocabItem) => `${item.word}::${item.context || ""}`;

const getRandomizedOptions = (items: VocabItem[], currentIndex: number): QuizOption[] => {
  const current = items[currentIndex];
  const correctLabel = current.translation?.trim() || "No translation available";
  const pool = items
    .filter((_, index) => index !== currentIndex)
    .map((item) => item.translation?.trim())
    .filter((entry): entry is string => Boolean(entry) && entry !== correctLabel);

  const uniquePool = Array.from(new Set(pool));
  while (uniquePool.length < 3) {
    uniquePool.push(`Distractor ${uniquePool.length + 1}`);
  }

  const distractors = uniquePool.sort(() => Math.random() - 0.5).slice(0, 3);
  return [correctLabel, ...distractors]
    .map((label) => ({ label, correct: label === correctLabel }))
    .sort(() => Math.random() - 0.5);
};

export const PracticeClient = () => {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [mode, setMode] = useState<PracticeMode>("flashcard");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [explanations, setExplanations] = useState<Record<string, ManualTranslateResponse>>({});
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const [sessionScore, setSessionScore] = useState<SessionScore>({
    again: 0,
    hard: 0,
    easy: 0,
  });

  useEffect(() => {
    const loadPractice = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getPracticeList();
        setItems(response.data);
      } catch (loadError: unknown) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError("Could not load practice data.");
        }
      } finally {
        setLoading(false);
      }
    };
    void loadPractice();
  }, []);

  const currentItem = items[currentIndex];
  const explanationKey = currentItem ? getExplanationKey(currentItem) : "";
  const currentExplanation = explanationKey ? explanations[explanationKey] : undefined;

  const quizOptions = useMemo(() => {
    if (!currentItem) return [];
    return getRandomizedOptions(items, currentIndex);
  }, [currentIndex, currentItem, items]);

  const ensureExplanation = async (item: VocabItem) => {
    const key = getExplanationKey(item);
    if (explanations[key]) return;

    const safeContext = item.context || `The word is ${item.word}`;

    setLoadingExplanation(true);
    try {
      const response = await translateManual({
        word: item.word,
        context: safeContext,
      });
      setExplanations((prev) => ({ ...prev, [key]: response }));
    } catch {
      setExplanations((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          message: "Could not load EN/VI explanation right now.",
        },
      }));
    } finally {
      setLoadingExplanation(false);
    }
  };

  const revealAnswer = () => {
    if (!currentItem) return;
    setRevealed(true);
    void ensureExplanation(currentItem);
  };

  const goNextCard = () => {
    if (currentIndex >= items.length - 1) {
      setFinished(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setRevealed(false);
    setSelectedOption(null);
  };

  const handleReview = async (quality: number, bucket: keyof SessionScore) => {
    if (!currentItem) return;
    setIsSubmittingReview(true);

    try {
      await updateProgress({
        word: currentItem.word,
        quality,
        context: currentItem.context,
        translation: currentItem.translation,
      });
      setSessionScore((prev) => ({ ...prev, [bucket]: prev[bucket] + 1 }));
    } catch {
      // Keep flow moving even if one review update fails.
    } finally {
      setIsSubmittingReview(false);
      goNextCard();
    }
  };

  if (loading) {
    return (
      <div className="panel rounded-3xl p-8 text-center text-sm text-slate-600">
        Loading practice session...
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel rounded-3xl p-8 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (finished || items.length === 0) {
    return (
      <div className="panel rounded-3xl p-8 md:p-10">
        <h1 className="text-4xl">Session complete</h1>
        <p className="mt-2 text-sm text-slate-600">
          You have finished today&apos;s SM-2 practice set.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-900/10 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Again</p>
            <p className="mt-2 text-3xl text-slate-800">{sessionScore.again}</p>
          </div>
          <div className="rounded-2xl border border-slate-900/10 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Hard</p>
            <p className="mt-2 text-3xl text-[#0f4c5c]">{sessionScore.hard}</p>
          </div>
          <div className="rounded-2xl border border-slate-900/10 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Easy</p>
            <p className="mt-2 text-3xl text-[#ad4f2f]">{sessionScore.easy}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0f4c5c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77]"
          >
            <RotateCcw size={16} />
            Restart session
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-900/15 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = ((currentIndex + 1) / items.length) * 100;
  const translationLine =
    currentExplanation?.vietnamese_translation || currentItem.translation || "No translation available";

  return (
    <div className="space-y-5">
      <header className="panel rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back to overview
            </Link>
            <h1 className="mt-3 text-3xl md:text-4xl">Practice Room</h1>
            <p className="mt-1 text-sm text-slate-600">
              Run SM-2 review using flashcards or quiz mode.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-900/10 bg-white/75 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("flashcard");
                setSelectedOption(null);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "flashcard" ? "bg-[#0f4c5c] text-white" : "text-slate-700"
              }`}
            >
              Flashcard
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("quiz");
                setSelectedOption(null);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "quiz" ? "bg-[#0f4c5c] text-white" : "text-slate-700"
              }`}
            >
              Quiz
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>
              Card {currentIndex + 1} / {items.length}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200/80">
            <div className="h-full rounded-full bg-[#0f4c5c]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <section className="panel rounded-3xl p-5 md:p-6">
        {mode === "flashcard" && (
          <div className="rounded-3xl border border-slate-900/10 bg-white/70 p-6 md:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              <BrainCircuit size={14} />
              Flashcard
            </p>
            <h2 className="mt-5 text-5xl text-[#0f4c5c]">{currentItem.word}</h2>
            <p className="mt-4 text-sm text-slate-600">{currentItem.context || "No source context provided."}</p>

            {!revealed && (
              <button
                type="button"
                onClick={revealAnswer}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-900/15 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reveal answer
                <CircleHelp size={16} />
              </button>
            )}
          </div>
        )}

        {mode === "quiz" && (
          <div className="rounded-3xl border border-slate-900/10 bg-white/70 p-6 md:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              <CircleHelp size={14} />
              Quiz
            </p>
            <h2 className="mt-4 text-3xl text-slate-900">Choose the best Vietnamese meaning</h2>
            <p className="mt-2 text-sm text-slate-600">
              Word: <span className="font-semibold text-[#0f4c5c]">{currentItem.word}</span>
            </p>

            <div className="mt-5 grid gap-3">
              {quizOptions.map((option) => {
                const isSelected = selectedOption === option.label;
                const showCorrect = selectedOption !== null && option.correct;
                const showWrong = isSelected && !option.correct;
                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={selectedOption !== null}
                    onClick={() => {
                      setSelectedOption(option.label);
                      setRevealed(true);
                      void ensureExplanation(currentItem);
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                      showCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : showWrong
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-slate-900/10 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {revealed && (
          <div className="mt-5 rounded-2xl border border-slate-900/10 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bilingual explanation
            </p>
            <p className="mt-2 text-lg font-semibold text-[#0f4c5c]">{translationLine}</p>

            {loadingExplanation && <p className="mt-3 text-sm text-slate-500">Loading EN/VI explanation...</p>}

            {!loadingExplanation && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <article className="rounded-xl border border-slate-900/10 bg-white/75 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">English</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {currentExplanation?.en_explanation || "No English explanation available."}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-900/10 bg-white/75 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vietnamese</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {currentExplanation?.vi_explanation || "No Vietnamese explanation available."}
                  </p>
                </article>
              </div>
            )}
          </div>
        )}
      </section>

      {revealed && (
        <section className="panel rounded-3xl p-5">
          <p className="text-sm font-semibold text-slate-700">How well did you remember this word?</p>
          <p className="mt-1 text-sm text-slate-500">
            Buttons below map to SM-2 quality updates.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={() => handleReview(0, "again")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle size={17} />
              Again
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={() => handleReview(3, "hard")}
              className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hard
            </button>
            <button
              type="button"
              disabled={isSubmittingReview}
              onClick={() => handleReview(5, "easy")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={17} />
              Easy
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
