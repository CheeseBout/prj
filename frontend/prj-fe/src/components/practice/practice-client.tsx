"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, RotateCcw } from "lucide-react";

import {
  getPracticeList,
  ProgressUpdateResponse,
  updateVocabProgress,
  VocabItem,
} from "@/lib/api";

const qualityChoices: Array<{ quality: number; label: string; className: string }> = [
  { quality: 0, label: "Quen han", className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200" },
  { quality: 1, label: "Sai, hoi quen", className: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200" },
  { quality: 2, label: "Sai, de nho lai", className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200" },
  { quality: 3, label: "Dung, hoi kho", className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200" },
  { quality: 4, label: "Dung, nho tot", className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" },
  { quality: 5, label: "Rat de", className: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200" },
];

export const PracticeClient = () => {
  const [practiceList, setPracticeList] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastResult, setLastResult] = useState<ProgressUpdateResponse | null>(null);

  const loadPracticeList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setShowAnswer(false);
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
    () => (currentIndex < practiceList.length ? practiceList[currentIndex] : null),
    [currentIndex, practiceList]
  );

  const doneCount = Math.min(currentIndex, practiceList.length);
  const totalCount = practiceList.length;

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
      setShowAnswer(false);
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
              On tap thuat ngu chuyen nganh bang thuat toan SM-2.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900/10 bg-white/75 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {doneCount}/{totalCount}
            </p>
            <p>words reviewed</p>
          </div>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {lastResult?.next_review_date && (
        <div className="panel rounded-3xl border border-[#0f4c5c]/15 bg-[#f2f9fa] p-4 text-sm text-slate-700">
          <p className="font-semibold text-[#0f4c5c]">SM-2 da cap nhat</p>
          <p className="mt-1">
            Lan lap: {lastResult.repetitions ?? "-"} | Interval: {lastResult.interval_days ?? "-"} ngay | EF:{" "}
            {typeof lastResult.ease_factor === "number" ? lastResult.ease_factor.toFixed(2) : "-"}
          </p>
          <p className="mt-1">
            Hen on tiep: {new Date(lastResult.next_review_date).toLocaleString()}
          </p>
        </div>
      )}

      <section className="panel rounded-3xl p-5 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-600">Loading due words...</p>
        ) : !currentWord ? (
          <div className="space-y-4 text-center">
            <BrainCircuit className="mx-auto text-[#0f4c5c]" size={32} />
            <p className="text-slate-700">Khong con tu den han on tap.</p>
            <button
              type="button"
              onClick={() => void loadPracticeList()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f4c5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#006d77]"
            >
              <RotateCcw size={15} />
              Tai lai danh sach
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3 rounded-2xl border border-slate-900/10 bg-white/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Word #{currentIndex + 1}
              </p>
              <h2 className="text-3xl font-semibold text-[#0f4c5c]">{currentWord.word}</h2>
              <p className="text-sm text-slate-600">{currentWord.context || "No context available."}</p>
            </div>

            {!showAnswer ? (
              <button
                type="button"
                onClick={() => setShowAnswer(true)}
                className="w-full rounded-2xl bg-[#0f4c5c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77]"
              >
                Hien thi dap an
              </button>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vietnamese meaning</p>
                  <p className="mt-2 text-lg text-slate-800">{currentWord.translation || "-"}</p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700">Danh gia do nho cua ban (SM-2 quality):</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {qualityChoices.map((choice) => (
                      <button
                        key={choice.quality}
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void handleQualitySelect(choice.quality)}
                        className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${choice.className}`}
                      >
                        {choice.label} ({choice.quality})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
