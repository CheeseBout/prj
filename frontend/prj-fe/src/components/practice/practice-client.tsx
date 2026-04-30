"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  GraduationCap,
  Layers,
  ListChecks,
  RotateCcw,
  Tag,
} from "lucide-react";

import {
  getPracticeList,
  getPracticeSpecializations,
  getQuiz,
  QuizQuestion,
  SpecializationOption,
  VocabItem,
} from "@/lib/api";

import {
  CardResult,
  getSpecColor,
  getSpecDisplayName,
  PracticeMode,
  PracticePhase,
} from "./practice-shared";
import { FlashcardMode } from "./flashcard-mode";
import { QuizMode } from "./quiz-mode";
import { SessionSummary } from "./session-summary";

/* ── Component ─────────────────────────────────────────────────── */

export const PracticeClient = () => {
  /* ── Phase management ───────────────────────────────────────── */
  const [phase, setPhase] = useState<PracticePhase>("config");
  const [selectedMode, setSelectedMode] = useState<PracticeMode>("flashcard");
  const [selectedSpec, setSelectedSpec] = useState("all");
  const [quizType, setQuizType] = useState<"en_to_vi" | "vi_to_en">("en_to_vi");

  /* ── Config data ────────────────────────────────────────────── */
  const [specOptions, setSpecOptions] = useState<SpecializationOption[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);

  /* ── Active data ────────────────────────────────────────────── */
  const [practiceList, setPracticeList] = useState<VocabItem[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Session tracking ───────────────────────────────────────── */
  const [sessionResults, setSessionResults] = useState<CardResult[]>([]);
  const sessionStartTime = useRef(Date.now());

  /* ── Load config ────────────────────────────────────────────── */
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await getPracticeSpecializations();
      setSpecOptions(res.data ?? []);
      setTotalDue(res.total_due ?? 0);
    } catch {
      setSpecOptions([]);
      setTotalDue(0);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  /* ── Start session ──────────────────────────────────────────── */
  const startSession = async () => {
    setActiveLoading(true);
    setError(null);
    sessionStartTime.current = Date.now();
    setSessionResults([]);

    try {
      if (selectedMode === "flashcard") {
        const res = await getPracticeList(selectedSpec !== "all" ? selectedSpec : undefined);
        if (!res.data?.length) {
          setError("No words due for review in this specialization.");
          setActiveLoading(false);
          return;
        }
        setPracticeList(res.data);
      } else {
        const res = await getQuiz(
          selectedSpec !== "all" ? selectedSpec : undefined,
          20,
          quizType,
        );
        if (!res.data?.length) {
          setError("Not enough words to generate a quiz. You need at least 4 words with translations.");
          setActiveLoading(false);
          return;
        }
        setQuizQuestions(res.data);
      }
      setPhase("active");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load session.");
    } finally {
      setActiveLoading(false);
    }
  };

  const handleFinish = (results: CardResult[]) => {
    setSessionResults(results);
    setPhase("summary");
  };

  const handleRestart = () => {
    setPhase("config");
    setSelectedSpec("all");
    setSessionResults([]);
    setError(null);
    void loadConfig();
  };

  /* ── Derived values ─────────────────────────────────────────── */
  const dueForSelected =
    selectedSpec === "all"
      ? totalDue
      : specOptions.find((s) => s.specialization === selectedSpec)?.due_count ?? 0;

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
        {phase !== "config" && (
          <button
            type="button"
            onClick={handleRestart}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/50 transition hover:text-foreground"
          >
            <RotateCcw size={14} />
            New session
          </button>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-foreground/[0.02]">
        <AnimatePresence mode="wait">
          {/* ── CONFIG PHASE ──────────────────────────────────── */}
          {phase === "config" && (
            <motion.div
              key="config"
              className="w-full max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {configLoading ? (
                <p className="editorial-meta animate-pulse text-center">Loading practice data...</p>
              ) : (
                <div className="space-y-6">
                  {/* Specialization picker */}
                  <div className="border border-foreground/10 bg-white p-8">
                    <div className="flex items-center gap-2 mb-5">
                      <Tag size={16} className="text-accent" />
                      <p className="editorial-meta text-foreground">Choose specialization</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {/* All option */}
                      <button
                        type="button"
                        onClick={() => setSelectedSpec("all")}
                        className={`flex flex-col items-start border px-4 py-3 text-left transition ${
                          selectedSpec === "all"
                            ? "border-accent bg-accent/5"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span className="text-sm font-semibold">All Fields</span>
                        <span className="text-xs text-foreground/40 mt-1">{totalDue} due</span>
                      </button>

                      {specOptions.map((opt) => {
                        const sc = getSpecColor(opt.specialization);
                        const isSelected = selectedSpec === opt.specialization;
                        return (
                          <button
                            key={opt.specialization}
                            type="button"
                            onClick={() => setSelectedSpec(opt.specialization)}
                            className={`flex flex-col items-start border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-accent bg-accent/5"
                                : "border-foreground/10 hover:bg-foreground/[0.03]"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: sc.text }}
                              />
                              <span className="text-sm font-semibold">
                                {getSpecDisplayName(opt.specialization)}
                              </span>
                            </span>
                            <span className="text-xs text-foreground/40 mt-1">
                              {opt.due_count} due
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode picker */}
                  <div className="border border-foreground/10 bg-white p-8">
                    <div className="flex items-center gap-2 mb-5">
                      <Layers size={16} className="text-accent" />
                      <p className="editorial-meta text-foreground">Choose practice mode</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMode("flashcard")}
                        className={`flex flex-col items-center gap-3 border p-6 transition ${
                          selectedMode === "flashcard"
                            ? "border-accent bg-accent/5"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <GraduationCap size={28} className={selectedMode === "flashcard" ? "text-accent" : "text-foreground/30"} />
                        <div className="text-center">
                          <p className="text-sm font-bold">Flashcard</p>
                          <p className="text-xs text-foreground/40 mt-1">Flip & self-assess</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMode("quiz")}
                        className={`flex flex-col items-center gap-3 border p-6 transition ${
                          selectedMode === "quiz"
                            ? "border-accent bg-accent/5"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <ListChecks size={28} className={selectedMode === "quiz" ? "text-accent" : "text-foreground/30"} />
                        <div className="text-center">
                          <p className="text-sm font-bold">Quiz</p>
                          <p className="text-xs text-foreground/40 mt-1">Multiple choice</p>
                        </div>
                      </button>
                    </div>

                    {/* Quiz sub-options */}
                    {selectedMode === "quiz" && (
                      <motion.div
                        className="mt-4 flex gap-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <button
                          type="button"
                          onClick={() => setQuizType("en_to_vi")}
                          className={`flex-1 border px-4 py-2.5 text-xs font-semibold transition ${
                            quizType === "en_to_vi"
                              ? "border-accent bg-accent/5 text-accent"
                              : "border-foreground/10 text-foreground/50 hover:bg-foreground/[0.03]"
                          }`}
                        >
                          EN → VI
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuizType("vi_to_en")}
                          className={`flex-1 border px-4 py-2.5 text-xs font-semibold transition ${
                            quizType === "vi_to_en"
                              ? "border-accent bg-accent/5 text-accent"
                              : "border-foreground/10 text-foreground/50 hover:bg-foreground/[0.03]"
                          }`}
                        >
                          VI → EN
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                  )}

                  {/* Start button */}
                  <button
                    type="button"
                    disabled={activeLoading || dueForSelected === 0}
                    onClick={() => void startSession()}
                    className="group flex w-full items-center justify-center gap-3 bg-foreground px-6 py-4 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {activeLoading ? (
                      <span className="animate-pulse">Loading session...</span>
                    ) : dueForSelected === 0 ? (
                      <span>No words due for review</span>
                    ) : (
                      <>
                        <BrainCircuit size={18} />
                        Start {selectedMode === "flashcard" ? "Flashcard" : "Quiz"} — {dueForSelected} words due
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── ACTIVE PHASE ─────────────────────────────────── */}
          {phase === "active" && (
            <motion.div
              key="active"
              className="w-full flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {selectedMode === "flashcard" ? (
                <FlashcardMode
                  practiceList={practiceList}
                  onFinish={handleFinish}
                />
              ) : (
                <QuizMode
                  questions={quizQuestions}
                  onFinish={handleFinish}
                />
              )}
            </motion.div>
          )}

          {/* ── SUMMARY PHASE ────────────────────────────────── */}
          {phase === "summary" && (
            <motion.div
              key="summary"
              className="w-full flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SessionSummary
                results={sessionResults}
                startTime={sessionStartTime.current}
                onRestart={handleRestart}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
