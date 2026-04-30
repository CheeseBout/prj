"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Search, Volume2 } from "lucide-react";

import { getVocabList, VocabItem } from "@/lib/api";

type StatusFilter = "all" | "unseen" | "learning" | "mastered";

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unseen", label: "Unseen" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
];

const statusIndicator: Record<string, string> = {
  unseen: "#999",
  learning: "#E85D04",
  mastered: "#1A1A1A",
};

export const VocabClient = () => {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVocabList(
        page,
        20,
        searchQuery,
        status === "all" ? undefined : status
      );
      setItems(response.data);
      setTotal(response.total);
    } catch (loadError: unknown) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Could not load vocabulary list.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const totalPages = Math.max(Math.ceil(total / 20), 1);

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header>
        <p className="editorial-meta">Collection</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">
          Vocabulary <em className="italic">Hub.</em>
        </h1>
        <p className="mt-2 text-sm text-foreground/50">
          Manage saved words with context, status, and learning priorities.
        </p>
      </header>

      {/* ── Filter Toolbar ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-foreground/10 pb-6 md:flex-row md:items-center md:justify-between">
        {/* Status tabs */}
        <div className="flex gap-0">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`border-b-2 px-5 py-3 text-sm font-medium transition ${
                status === tab.value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-foreground/25"
            size={16}
          />
          <input
            type="text"
            placeholder="Search vocabulary..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full border-b border-foreground/15 bg-transparent pb-2 pl-7 text-sm outline-none transition focus:border-accent md:w-64"
          />
        </form>
      </div>

      {error && (
        <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Word Grid ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="editorial-meta animate-pulse">Loading vocabulary...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-foreground/40">
            No entries match the current filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <article
              key={`${item.word}-${index}`}
              className="group relative border border-foreground/10 bg-white p-6 transition hover:border-foreground/20"
            >
              {/* Status indicator line */}
              <div
                className="absolute left-0 top-0 h-full w-0.5"
                style={{
                  backgroundColor: statusIndicator[item.status] ?? "#999",
                }}
              />

              {/* Top section: word + pronunciation */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl font-bold">{item.word}</h3>
                  <p className="mt-1 text-xs text-foreground/40">
                    {item.specialization
                      ? item.specialization.charAt(0).toUpperCase() +
                        item.specialization.slice(1)
                      : "General"}{" "}
                    ·{" "}
                    {item.difficulty
                      ? item.difficulty.charAt(0).toUpperCase() +
                        item.difficulty.slice(1)
                      : "Intermediate"}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground/30 transition hover:bg-foreground/5 hover:text-foreground/60"
                  title="Pronounce"
                >
                  <Volume2 size={14} />
                </button>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-foreground/8" />

              {/* Bottom section: Vietnamese meaning */}
              <p className="text-sm text-foreground/65">
                {item.translation || "No translation available"}
              </p>
              {item.context && (
                <p className="mt-2 line-clamp-2 text-xs text-foreground/35">
                  &ldquo;{item.context}&rdquo;
                </p>
              )}

              {/* Status badge */}
              <div className="mt-4 flex items-center justify-between">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor:
                      item.status === "mastered"
                        ? "rgba(26,26,26,0.06)"
                        : item.status === "learning"
                        ? "rgba(232,93,4,0.08)"
                        : "rgba(153,153,153,0.1)",
                    color: statusIndicator[item.status] ?? "#999",
                  }}
                >
                  {item.status}
                </span>
                {item.next_review_date && (
                  <span className="text-[10px] text-foreground/30">
                    {new Date(item.next_review_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-foreground/10 pt-6">
        <p className="text-xs text-foreground/40">
          {total} total · Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="border border-foreground/10 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="border border-foreground/10 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
