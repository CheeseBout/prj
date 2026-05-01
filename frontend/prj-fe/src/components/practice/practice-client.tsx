"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
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
  getTags,
  QuizQuestion,
  SpecializationOption,
  TagOption,
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

  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");

  /* ── Config data ────────────────────────────────────────────── */
  const [specOptions, setSpecOptions] = useState<SpecializationOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);

  /* ── Source management ──────────────────────────────────────── */
  const [source, setSource] = useState<"review" | "collection">(initialTag ? "collection" : "review");
  const [selectedTag, setSelectedTag] = useState<string>(initialTag || "all");

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
      const [specRes, tagsRes] = await Promise.all([
        getPracticeSpecializations().catch(() => ({ data: [], total_due: 0 })),
        getTags().catch(() => ({ data: [] }))
      ]);
      setSpecOptions(specRes.data ?? []);
      setTotalDue(specRes.total_due ?? 0);
      setTagOptions(tagsRes.data ?? []);
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
        const res = await getPracticeList(
          selectedSpec !== "all" ? selectedSpec : undefined,
          source === "collection" && selectedTag !== "all" ? [selectedTag] : undefined
        );
        if (!res.data?.length) {
          setError("No words due for review with the selected filters.");
          setActiveLoading(false);
          return;
        }
        setPracticeList(res.data);
      } else {
        const res = await getQuiz(
          selectedSpec !== "all" ? selectedSpec : undefined,
          20,
          quizType,
          source === "collection" && selectedTag !== "all" ? [selectedTag] : undefined
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
  const dueForSelected = useMemo(() => {
    if (source === "collection" && selectedTag !== "all") {
      return tagOptions.find(t => t.tag === selectedTag)?.due_count ?? 0;
    }
    if (selectedSpec !== "all") {
      return specOptions.find(s => s.specialization === selectedSpec)?.due_count ?? 0;
    }
    return totalDue;
  }, [source, selectedTag, selectedSpec, tagOptions, specOptions, totalDue]);

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
                  {/* Source picker */}
                  <div className="border border-foreground/10 bg-white p-8">
                    <div className="flex items-center gap-2 mb-5">
                      <Tag size={16} className="text-accent" />
                      <p className="editorial-meta text-foreground">Choose Source</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => setSource("review")}
                        className={`flex flex-col items-center gap-2 border p-4 transition ${
                          source === "review"
                            ? "border-accent bg-accent/5 text-accent"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span className="text-sm font-bold">Words to Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSource("collection")}
                        className={`flex flex-col items-center gap-2 border p-4 transition ${
                          source === "collection"
                            ? "border-accent bg-accent/5 text-accent"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span className="text-sm font-bold">By Collection/Tags</span>
                      </button>
                    </div>

                    {source === "collection" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">Select Tag</label>
                        <select
                          value={selectedTag}
                          onChange={(e) => setSelectedTag(e.target.value)}
                          className="w-full border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-accent"
                        >
                          <option value="all">All Tags ({totalDue} due)</option>
                          {tagOptions.map(t => (
                            <option key={t.tag} value={t.tag}>{t.tag} ({t.due_count} due)</option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    {source === "review" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">Filter by Specialization (Optional)</label>
                        <select
                          value={selectedSpec}
                          onChange={(e) => setSelectedSpec(e.target.value)}
                          className="w-full border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-accent"
                        >
                          <option value="all">All Fields ({totalDue} due)</option>
                          {specOptions.map(s => (
                            <option key={s.specialization} value={s.specialization}>{s.specialization} ({s.due_count} due)</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
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
