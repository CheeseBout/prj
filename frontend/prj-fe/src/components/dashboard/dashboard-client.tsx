"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Flame,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  getMe,
  getVocabList,
  getVocabStats,
  UserResponse,
  VocabItem,
  VocabStats,
} from "@/lib/api";

const MAX_SCAN_ITEMS = 2000;
const PAGE_LIMIT = 200;

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDateKey = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
};

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const DashboardClient = () => {
  const router = useRouter();
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [partialDataNote, setPartialDataNote] = useState<string | null>(null);

  const loadHubData = useCallback(async () => {
    setLoading(true);
    setPartialDataNote(null);

    try {
      const [me, statsData, pageOne] = await Promise.all([
        getMe(),
        getVocabStats(),
        getVocabList(1, PAGE_LIMIT),
      ]);

      setProfile(me);
      setStats(statsData);

      let combined = pageOne.data;
      const total = pageOne.total ?? combined.length;
      const totalPages = Math.max(Math.ceil(total / PAGE_LIMIT), 1);

      for (let page = 2; page <= totalPages; page += 1) {
        if (combined.length >= MAX_SCAN_ITEMS) {
          setPartialDataNote(
            `Showing metrics for the first ${MAX_SCAN_ITEMS} words for performance.`
          );
          break;
        }
        const response = await getVocabList(page, PAGE_LIMIT);
        combined = [...combined, ...response.data];
      }

      setVocabItems(combined);
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadHubData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHubData]);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const reviewedPool =
      (stats?.data.learning ?? 0) + (stats?.data.mastered ?? 0);
    const retentionRate =
      reviewedPool > 0
        ? Math.round(((stats?.data.mastered ?? 0) / reviewedPool) * 100)
        : 0;

    const dueToday = vocabItems.filter((item) => {
      if (item.status === "unseen") return false;
      const reviewDate = safeDate(item.next_review_date);
      if (!reviewDate) return false;
      return reviewDate <= todayStart;
    }).length;

    const forecastBuckets = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(todayStart);
      date.setDate(todayStart.getDate() + index);
      const dateKey = toDateKey(date);
      const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
      return { dateKey, dayLabel, count: 0 };
    });

    const scheduleCountByDay = new Map<string, number>();
    for (const item of vocabItems) {
      if (item.status === "unseen") continue;
      const key = parseDateKey(item.next_review_date);
      if (!key) continue;
      scheduleCountByDay.set(key, (scheduleCountByDay.get(key) ?? 0) + 1);
    }

    for (const bucket of forecastBuckets) {
      bucket.count = scheduleCountByDay.get(bucket.dateKey) ?? 0;
    }

    const recentWords = [...vocabItems]
      .sort((a, b) => {
        const dateA = safeDate(a.next_review_date)?.getTime() ?? 0;
        const dateB = safeDate(b.next_review_date)?.getTime() ?? 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    const collections = (() => {
      const tagMap = new Map<string, { total: number, mastered: number, due: number }>();
      for (const item of vocabItems) {
        if (item.tags && Array.isArray(item.tags)) {
          for (const tag of item.tags) {
            if (!tagMap.has(tag)) tagMap.set(tag, { total: 0, mastered: 0, due: 0 });
            const stats = tagMap.get(tag)!;
            stats.total++;
            if (item.status === "mastered") stats.mastered++;
            
            const reviewDate = safeDate(item.next_review_date);
            if (item.status !== "unseen" && reviewDate && reviewDate <= todayStart) {
              stats.due++;
            }
          }
        }
      }
      return Array.from(tagMap.entries())
        .map(([tag, stats]) => ({ tag, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6); // show top 6 collections
    })();

    return {
      dueToday,
      retentionRate,
      forecastBuckets,
      recentWords,
      collections,
    };
  }, [stats, vocabItems]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="editorial-meta animate-pulse">Loading Learning Hub...</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Saved words",
      value: stats?.data.total_words ?? 0,
      color: "#1A1A1A",
    },
    {
      label: "Learning",
      value: stats?.data.learning ?? 0,
      color: "#E85D04",
    },
    {
      label: "Mastered",
      value: stats?.data.mastered ?? 0,
      color: "#1A1A1A",
    },
    {
      label: "Unseen",
      value: stats?.data.unseen ?? 0,
      color: "#999",
    },
  ];

  const statusColor: Record<string, string> = {
    unseen: "#999",
    learning: "#E85D04",
    mastered: "#1A1A1A",
  };

  return (
    <div className="space-y-8">
      {/* ── Tầng 1: Header ──────────────────────────────────────── */}
      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="editorial-meta">Overview</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl">
            Learning <em className="italic">Hub.</em>
          </h1>
          <p className="mt-2 text-sm text-foreground/50">
            Welcome back, {profile?.full_name || "learner"}.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Streak badge */}
          <div className="flex items-center gap-2 rounded-full border border-foreground/10 px-4 py-2">
            <Flame size={16} className="text-accent" />
            <span className="text-sm font-bold">{stats?.data.streak ?? 0}</span>
            <span className="text-xs text-foreground/40">day streak</span>
          </div>
        </div>
      </header>

      {/* ── Tầng 2: Stats ───────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.label} className="border-t-2 border-foreground/15 pt-4">
            <p className="editorial-meta">{card.label}</p>
            <p
              className="mt-2 font-serif text-4xl"
              style={{ color: card.color }}
            >
              {card.value}
            </p>
          </article>
        ))}
      </section>

      {/* ── Tầng 3: Chart ───────────────────────────────────────── */}
      <section className="border border-foreground/10 p-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="editorial-meta">Review forecast</p>
            <h2 className="mt-2 font-serif text-2xl">
              Words due in the next 7 days
            </h2>
          </div>
          <TrendingUp size={18} className="text-foreground/30" />
        </div>

        <div className="mt-8 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.forecastBuckets}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E85D04" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E85D04" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(26,26,26,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="dayLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#999" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#999" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1A1A1A",
                  border: "none",
                  borderRadius: 0,
                  color: "#FAF9F6",
                  fontSize: 12,
                }}
                itemStyle={{ color: "#FAF9F6" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#E85D04"
                strokeWidth={2}
                fill="url(#colorCount)"
                name="Words"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Tầng 4: Practice CTA + Recent Words ─────────────────── */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Practice CTA - 2 columns */}
        <article className="flex flex-col justify-between border border-foreground/10 p-8 md:col-span-2">
          <div>
            <p className="editorial-meta">Today&apos;s mission</p>
            <h2 className="mt-3 font-serif text-3xl">
              <span className="text-accent">{metrics.dueToday}</span> words due
              for review
            </h2>
            <p className="mt-3 text-sm text-foreground/50">
              Retention rate:{" "}
              <span className="font-semibold text-foreground">
                {metrics.retentionRate}%
              </span>{" "}
              (mastered / reviewed pool)
            </p>
          </div>
          <Link
            href="/practice"
            className="group mt-8 inline-flex items-center gap-2 self-start bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#d04f00]"
          >
            Enter practice room
            <ArrowRight
              size={15}
              className="transition group-hover:translate-x-1"
            />
          </Link>
        </article>

        {/* Recent Words - 1 column */}
        <article className="border border-foreground/10 p-8">
          <p className="editorial-meta">Recently saved</p>
          <div className="mt-6 space-y-4">
            {metrics.recentWords.length === 0 && (
              <p className="text-sm text-foreground/40">No words yet.</p>
            )}
            {metrics.recentWords.map((item, index) => (
              <div
                key={`${item.word}-${index}`}
                className="flex items-center gap-3"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: statusColor[item.status] ?? "#999",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.word}</p>
                  <p className="truncate text-xs text-foreground/40">
                    {item.translation || "No translation"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/vocab"
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/50 transition hover:text-foreground"
          >
            <BookOpenCheck size={14} />
            View all
          </Link>
        </article>
      </section>

      {/* ── Tầng 5: Collections ─────────────────────────────────── */}
      <section className="border-t border-foreground/10 pt-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="editorial-meta">Your Collections</p>
            <h2 className="mt-2 font-serif text-2xl">
              Vocabulary by Tags
            </h2>
          </div>
          <Link
            href="/vocab"
            className="text-xs font-semibold uppercase tracking-widest text-foreground/50 transition hover:text-foreground"
          >
            Manage Tags
          </Link>
        </div>

        {metrics.collections.length === 0 ? (
          <div className="border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/40">
            You don&apos;t have any collections yet. Add tags to your vocabulary to create collections.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.collections.map((col) => (
              <article key={col.tag} className="flex flex-col justify-between border border-foreground/10 bg-white p-6 transition hover:border-foreground/20">
                <div>
                  <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                    <span className="text-accent">#</span>{col.tag}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/50">
                    Total: <span className="font-semibold text-foreground">{col.total}</span> words
                    <span className="mx-2">·</span>
                    Mastered: <span className="font-semibold text-foreground">{col.mastered}</span>
                  </p>
                  
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full bg-foreground/5 overflow-hidden">
                    <div 
                      className="h-full bg-foreground transition-all duration-500" 
                      style={{ width: `${Math.round((col.mastered / col.total) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Link
                    href={`/practice?tag=${encodeURIComponent(col.tag)}`}
                    className="flex-1 text-center bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:bg-foreground/80"
                  >
                    {col.due > 0 ? `Practice (${col.due} due)` : "Practice"}
                  </Link>
                  <Link
                    href={`/vocab?tag=${encodeURIComponent(col.tag)}`}
                    className="flex-1 text-center border border-foreground/10 px-3 py-2 text-xs font-semibold transition hover:bg-foreground/5"
                  >
                    View details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {partialDataNote && (
        <p className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {partialDataNote}
        </p>
      )}
    </div>
  );
};