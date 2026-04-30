import { ProgressUpdateResponse } from "@/lib/api";

/* ── SM-2 quality choices ──────────────────────────────────────── */

export const qualityChoices: Array<{
  quality: number;
  label: string;
  color: string;
  bgHover: string;
}> = [
  { quality: 0, label: "Forgot", color: "#dc2626", bgHover: "rgba(220,38,38,0.15)" },
  { quality: 1, label: "Wrong, vague", color: "#ea580c", bgHover: "rgba(234,88,12,0.15)" },
  { quality: 2, label: "Wrong, recalled", color: "#ca8a04", bgHover: "rgba(202,138,4,0.15)" },
  { quality: 3, label: "Correct, hard", color: "#2563eb", bgHover: "rgba(37,99,235,0.15)" },
  { quality: 4, label: "Correct, good", color: "#16a34a", bgHover: "rgba(22,163,74,0.15)" },
  { quality: 5, label: "Very easy", color: "#059669", bgHover: "rgba(5,150,105,0.15)" },
];

/* ── Specialization config ─────────────────────────────────────── */

export const specColors: Record<string, { bg: string; text: string; border: string }> = {
  ai_computer_science: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  healthcare_medicine: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  social_sciences: { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  economics_business: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  science_engineering: { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  math_data_science: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  academic_research: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

export const defaultSpecColor = { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };

export const specDisplayNames: Record<string, string> = {
  ai_computer_science: "AI & Computer Science",
  economics_business: "Economics & Business",
  healthcare_medicine: "Healthcare & Medicine",
  math_data_science: "Math & Data Science",
  science_engineering: "Science & Engineering",
  social_sciences: "Social Sciences",
  academic_research: "Academic Research",
};

export const getSpecColor = (spec?: string) => {
  if (!spec) return defaultSpecColor;
  return specColors[spec] ?? defaultSpecColor;
};

export const getSpecDisplayName = (spec: string) =>
  specDisplayNames[spec] ?? spec.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ── Difficulty config ─────────────────────────────────────────── */

export const difficultyColorMap: Record<string, string> = {
  basic: "#16a34a",
  intermediate: "#ca8a04",
  advanced: "#dc2626",
};

/* ── Session result per card ───────────────────────────────────── */

export interface CardResult {
  word: string;
  quality: number;
  response: ProgressUpdateResponse;
}

/* ── Types ─────────────────────────────────────────────────────── */

export type PracticeMode = "flashcard" | "quiz";
export type PracticePhase = "config" | "active" | "summary";

export const formatDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
};
