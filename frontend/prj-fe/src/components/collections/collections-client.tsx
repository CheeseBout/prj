"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, Flame, Plus, Tags, ArrowRight } from "lucide-react";

import { getTags, TagOption } from "@/lib/api";

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 40%)`;
};

export const CollectionsClient = () => {
  const [collections, setCollections] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getTags()
      .then((res) => {
        // Sort collections by word_count descending
        const sorted = (res.data || []).sort((a, b) => b.word_count - a.word_count);
        setCollections(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError("Could not load collections. Please try again later.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="editorial-meta">Organize</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl">
            Your <em className="italic">Collections.</em>
          </h1>
          <p className="mt-2 text-sm text-foreground/50">
            Group your vocabulary using tags for focused practice sessions.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/vocab"
            className="flex items-center gap-2 rounded-sm bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/80"
          >
            <Plus size={16} />
            New Tag
          </Link>
        </div>
      </header>

      {error && (
        <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Collections Grid ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="editorial-meta animate-pulse">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-foreground/20 py-24 text-center">
          <Tags size={48} className="mb-4 text-foreground/20" />
          <h3 className="font-serif text-2xl font-bold">No collections found</h3>
          <p className="mt-2 max-w-md text-sm text-foreground/50">
            You haven&apos;t created any collections yet. Go to your vocabulary hub to add tags to your words, which will automatically create collections here.
          </p>
          <Link
            href="/vocab"
            className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent transition hover:text-[#d04f00]"
          >
            Go to Vocabulary <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((col) => {
            const color = getTagColor(col.tag);
            return (
              <article
                key={col.tag}
                className="group relative flex flex-col justify-between border border-foreground/10 bg-white p-6 transition hover:border-foreground/20 hover:shadow-sm"
              >
                {/* Decorative top border */}
                <div
                  className="absolute left-0 top-0 h-1 w-full"
                  style={{ backgroundColor: color }}
                />

                <div>
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-serif text-xl font-bold line-clamp-1 flex items-center gap-2">
                      <span style={{ color }}>#</span>
                      {col.tag}
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-foreground/50">Total words</span>
                    <span className="font-semibold text-foreground">{col.word_count}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-foreground/50">Due for review</span>
                    <span className={`font-semibold ${col.due_count > 0 ? "text-accent" : "text-foreground"}`}>
                      {col.due_count}
                    </span>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-3">
                  <Link
                    href={`/practice?tag=${encodeURIComponent(col.tag)}`}
                    className="flex-1 text-center bg-foreground px-3 py-2.5 text-xs font-semibold text-background transition hover:bg-foreground/80 disabled:opacity-50"
                    style={{ pointerEvents: col.due_count > 0 ? 'auto' : 'none', opacity: col.due_count > 0 ? 1 : 0.5 }}
                  >
                    Practice
                  </Link>
                  <Link
                    href={`/vocab?tag=${encodeURIComponent(col.tag)}`}
                    className="flex-1 text-center border border-foreground/10 px-3 py-2.5 text-xs font-semibold transition hover:bg-foreground/5"
                  >
                    View list
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
