"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  getAllSavedVocab,
  SpecializationOption,
  TagOption,
  TestQuestion,
  VocabItem,
  startTestSession,
} from "@/lib/api";

import { CardResult, PracticeMode, PracticePhase } from "./practice-shared";
import { FlashcardMode } from "./flashcard-mode";
import { QuizMode } from "./quiz-mode";
import { SessionSummary } from "./session-summary";

const DEFAULT_TEST_COUNT = 20;

const normalizeText = (value?: string | null) => (value ?? "").trim().toLowerCase();

export const PracticeClient = () => {
  const [phase, setPhase] = useState<PracticePhase>("config");
  const [selectedMode, setSelectedMode] = useState<PracticeMode>("flashcard");
  const [selectedSpec, setSelectedSpec] = useState("all");

  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");

  const [allSavedWords, setAllSavedWords] = useState<VocabItem[]>([]);
  const [specOptions, setSpecOptions] = useState<SpecializationOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);

  const [source, setSource] = useState<"all" | "collection">(
    initialTag ? "collection" : "all"
  );
  const [selectedTag, setSelectedTag] = useState<string>(initialTag || "all");

  const [practiceList, setPracticeList] = useState<VocabItem[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<TestQuestion[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionResults, setSessionResults] = useState<CardResult[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [sessionDurationMs, setSessionDurationMs] = useState(0);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const words = await getAllSavedVocab();
      setAllSavedWords(words);
      setTotalSaved(words.length);

      const specMap = new Map<string, number>();
      const tagMap = new Map<string, number>();

      words.forEach((item) => {
        const spec = item.specialization?.trim();
        if (spec) {
          specMap.set(spec, (specMap.get(spec) ?? 0) + 1);
        }

        item.tags?.forEach((tag) => {
          const normalizedTag = tag.trim().toLowerCase();
          if (!normalizedTag) return;
          tagMap.set(normalizedTag, (tagMap.get(normalizedTag) ?? 0) + 1);
        });
      });

      const specs: SpecializationOption[] = Array.from(specMap.entries())
        .map(([specialization, count]) => ({
          specialization,
          due_count: count,
        }))
        .sort((a, b) => b.due_count - a.due_count);

      const tags: TagOption[] = Array.from(tagMap.entries())
        .map(([tag, count]) => ({
          tag,
          word_count: count,
          due_count: count,
        }))
        .sort((a, b) => b.word_count - a.word_count);

      setSpecOptions(specs);
      setTagOptions(tags);
    } catch {
      setAllSavedWords([]);
      setSpecOptions([]);
      setTagOptions([]);
      setTotalSaved(0);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConfig();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadConfig]);

  const filteredWords = useMemo(() => {
    let output = [...allSavedWords];

    if (source === "all" && selectedSpec !== "all") {
      output = output.filter((item) => item.specialization === selectedSpec);
    }

    if (source === "collection" && selectedTag !== "all") {
      output = output.filter((item) =>
        item.tags?.some((tag) => normalizeText(tag) === normalizeText(selectedTag))
      );
    }

    return output;
  }, [allSavedWords, source, selectedSpec, selectedTag]);

  const availableForSelected = filteredWords.length;

  const startSession = async () => {
    setActiveLoading(true);
    setError(null);
    setSessionStartedAt(Date.now());
    setSessionDurationMs(0);
    setSessionResults([]);

    try {
      if (!filteredWords.length) {
        setError("No saved vocabulary found for the selected filters.");
        return;
      }

      if (selectedMode === "flashcard") {
        setPracticeList(filteredWords);
      } else {
        const res = await startTestSession({
          count: DEFAULT_TEST_COUNT,
          specialization: source === "all" && selectedSpec !== "all" ? selectedSpec : undefined,
          tag: source === "collection" && selectedTag !== "all" ? selectedTag : undefined,
          due_only: true,
        });
        if (!res.data?.length) {
          setError("No questions available for current filters.");
          return;
        }
        setQuizQuestions(res.data);
      }

      setPhase("active");
    } catch (unknownError: unknown) {
      setError(unknownError instanceof Error ? unknownError.message : "Failed to load session.");
    } finally {
      setActiveLoading(false);
    }
  };

  const handleFinish = (results: CardResult[]) => {
    setSessionResults(results);
    setSessionDurationMs(sessionStartedAt > 0 ? Math.max(0, Date.now() - sessionStartedAt) : 0);
    setPhase("summary");
  };

  const handleRestart = () => {
    setPhase("config");
    setSelectedSpec("all");
    setSessionResults([]);
    setError(null);
    void loadConfig();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 pb-6">
        <div>
          <p className="editorial-meta">Practice room</p>
          <h1 className="mt-2 font-serif text-3xl">
            Practice & <em className="italic">Test.</em>
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

      <div className="flex flex-1 items-center justify-center bg-foreground/[0.02]">
        <AnimatePresence mode="wait">
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
                  <div className="border border-foreground/10 bg-white p-8">
                    <div className="mb-5 flex items-center gap-2">
                      <Tag size={16} className="text-accent" />
                      <p className="editorial-meta text-foreground">Choose Source</p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSource("all")}
                        className={`flex flex-col items-center gap-2 border p-4 transition ${
                          source === "all"
                            ? "border-accent bg-accent/5 text-accent"
                            : "border-foreground/10 hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span className="text-sm font-bold">All Saved Words</span>
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
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Select Tag
                        </label>
                        <select
                          value={selectedTag}
                          onChange={(event) => setSelectedTag(event.target.value)}
                          className="w-full border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-accent"
                        >
                          <option value="all">All Tags ({totalSaved} words)</option>
                          {tagOptions.map((tag) => (
                            <option key={tag.tag} value={tag.tag}>
                              {tag.tag} ({tag.word_count} words)
                            </option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    {source === "all" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
                          Filter by Specialization (Optional)
                        </label>
                        <select
                          value={selectedSpec}
                          onChange={(event) => setSelectedSpec(event.target.value)}
                          className="w-full border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-accent"
                        >
                          <option value="all">All Fields ({totalSaved} words)</option>
                          {specOptions.map((spec) => (
                            <option key={spec.specialization} value={spec.specialization}>
                              {spec.specialization} ({spec.due_count} words)
                            </option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </div>

                  <div className="border border-foreground/10 bg-white p-8">
                    <div className="mb-5 flex items-center gap-2">
                      <Layers size={16} className="text-accent" />
                      <p className="editorial-meta text-foreground">Choose mode</p>
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
                        <GraduationCap
                          size={28}
                          className={selectedMode === "flashcard" ? "text-accent" : "text-foreground/30"}
                        />
                        <div className="text-center">
                          <p className="text-sm font-bold">Flashcard</p>
                          <p className="mt-1 text-xs text-foreground/40">Browse saved vocabulary</p>
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
                        <ListChecks
                          size={28}
                          className={selectedMode === "quiz" ? "text-accent" : "text-foreground/30"}
                        />
                        <div className="text-center">
                          <p className="text-sm font-bold">Test</p>
                          <p className="mt-1 text-xs text-foreground/40">Multiple choice with SM-2 updates</p>
                        </div>
                      </button>
                    </div>

                    {selectedMode === "quiz" && (
                      <motion.div
                        className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        Questions are generated in English and reused from the backend question bank.
                      </motion.div>
                    )}
                  </div>

                  {error && (
                    <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={activeLoading || availableForSelected === 0}
                    onClick={() => void startSession()}
                    className="group flex w-full items-center justify-center gap-3 bg-foreground px-6 py-4 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {activeLoading ? (
                      <span className="animate-pulse">Loading session...</span>
                    ) : availableForSelected === 0 ? (
                      <span>No saved words for current filters</span>
                    ) : (
                      <>
                        <BrainCircuit size={18} />
                        Start {selectedMode === "flashcard" ? "Flashcard" : "Test"} - {availableForSelected} words
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {phase === "active" && (
            <motion.div
              key="active"
              className="flex w-full justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {selectedMode === "flashcard" ? (
                <FlashcardMode practiceList={practiceList} onFinish={handleFinish} />
              ) : (
                <QuizMode questions={quizQuestions} onFinish={handleFinish} />
              )}
            </motion.div>
          )}

          {phase === "summary" && (
            <motion.div
              key="summary"
              className="flex w-full justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SessionSummary
                results={sessionResults}
                durationMs={sessionDurationMs}
                onRestart={handleRestart}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
