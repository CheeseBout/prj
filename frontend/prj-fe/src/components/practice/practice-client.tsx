"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BrainCircuit, RotateCcw } from "lucide-react";

import {
  getPracticeList,
  ProgressUpdateResponse,
  updateVocabProgress,
  VocabItem,
} from "@/lib/api";

const qualityChoices: Array<{
  quality: number;
  label: string;
  color: string;
}> = [
  { quality: 0, label: "Forgot", color: "#dc2626" },
  { quality: 1, label: "Wrong, vague", color: "#ea580c" },
  { quality: 2, label: "Wrong, recalled", color: "#ca8a04" },
  { quality: 3, label: "Correct, hard", color: "#2563eb" },
  { quality: 4, label: "Correct, good", color: "#16a34a" },
  { quality: 5, label: "Very easy", color: "#059669" },
];

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

  const loadPracticeList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setLastResult(null);

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
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
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
            {String(currentIndex + 1).padStart(2, "0")}
          </p>
          <p className="editorial-meta">
            of {String(totalCount).padStart(2, "0")}
          </p>
        </div>
      </header>

      {error && (
        <div className="mt-4 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lastResult?.next_review_date && (
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
        {loading ? (
          <p className="editorial-meta animate-pulse">Loading due words...</p>
        ) : !currentWord ? (
          <div className="space-y-6 text-center">
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
          </div>
        ) : (
          <div className="w-full max-w-2xl">
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
                  <p className="editorial-meta text-accent">
                    Word #{currentIndex + 1}
                  </p>
                  <h2 className="mt-6 font-serif text-5xl">{currentWord.word}</h2>
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
          </div>
        )}
      </div>
    </div>
  );
};
