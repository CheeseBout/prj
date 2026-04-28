"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Filter, Search, Table2, Tags } from "lucide-react";

import { getVocabList, VocabItem } from "@/lib/api";

type Specialization = "all" | "technology" | "business" | "science" | "general";
type Difficulty = "all" | "basic" | "intermediate" | "advanced";

const statusMap: Record<string, { label: string; className: string }> = {
  unseen: { label: "Unseen", className: "bg-slate-100 text-slate-700" },
  learning: { label: "Learning", className: "bg-[#d8f0f3] text-[#0f4c5c]" },
  mastered: { label: "Mastered", className: "bg-[#ffe7de] text-[#ad4f2f]" },
};

export const VocabClient = () => {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [specialization, setSpecialization] = useState<Specialization>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
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
        status,
        specialization,
        difficulty
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
  }, [difficulty, page, searchQuery, specialization, status]);

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
            <h1 className="mt-3 text-3xl md:text-4xl">Vocabulary Hub</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage saved words with context, status, and learning priorities.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-white/75 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{total}</p>
            <p>total words</p>
          </div>
        </div>
      </header>

      <section className="panel rounded-3xl p-5 md:p-6">
        <form onSubmit={handleSearch} className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto]">
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search vocabulary..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Status</span>
            <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
            >
              <option value="all">All status</option>
              <option value="unseen">Unseen</option>
              <option value="learning">Learning</option>
              <option value="mastered">Mastered</option>
            </select>
          </label>

          <label className="relative">
            <span className="sr-only">Specialization</span>
            <Tags className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <select
              value={specialization}
              onChange={(event) => {
                setSpecialization(event.target.value as Specialization);
                setPage(1);
              }}
              className="w-full appearance-none rounded-2xl border border-slate-900/15 bg-white px-10 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
            >
              <option value="all">All majors</option>
              <option value="technology">Technology</option>
              <option value="business">Business</option>
              <option value="science">Science</option>
              <option value="general">General</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Difficulty</span>
            <select
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value as Difficulty);
                setPage(1);
              }}
              className="w-full appearance-none rounded-2xl border border-slate-900/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4c5c] focus:ring-4 focus:ring-[#006d77]/15"
            >
              <option value="all">All levels</option>
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-[#0f4c5c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#006d77]"
          >
            Search
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-900/10">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-slate-100/70 text-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Vocabulary</th>
                <th className="px-4 py-3 font-semibold">Vietnamese meaning</th>
                <th className="px-4 py-3 font-semibold">Original context</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Next review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/10 bg-white/75">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading vocabulary list...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No entries match the current filter.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item, index) => {
                  const displayStatus = statusMap[item.status] || statusMap.unseen;
                  const specializationLabel = item.specialization
                    ? item.specialization.charAt(0).toUpperCase() + item.specialization.slice(1)
                    : "General";
                  const difficultyLabel = item.difficulty
                    ? item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)
                    : "Intermediate";

                  return (
                    <tr key={`${item.word}-${index}`} className="align-top text-slate-700">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0f4c5c]">{item.word}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {specializationLabel} | {difficultyLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3">{item.translation || "-"}</td>
                      <td className="max-w-md px-4 py-3 text-slate-600">
                        <p className="line-clamp-2">{item.context || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${displayStatus.className}`}
                        >
                          {displayStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.next_review_date
                          ? new Date(item.next_review_date).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Table2 size={16} />
            Showing {items.length} item(s) on this page
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-slate-600">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
