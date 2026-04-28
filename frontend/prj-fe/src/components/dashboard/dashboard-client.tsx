"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Languages,
  LogOut,
} from "lucide-react";

import { getMe, getVocabList, getVocabStats, logout, UserResponse, VocabItem, VocabStats } from "@/lib/api";

const MAX_SCAN_ITEMS = 2000;
const PAGE_LIMIT = 200;

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

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
            `Dang hien thi ${MAX_SCAN_ITEMS} tu dau tien de tinh metric nhanh va on dinh.`
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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const reviewedPool = (stats?.data.learning ?? 0) + (stats?.data.mastered ?? 0);
    const retentionRate =
      reviewedPool > 0 ? Math.round(((stats?.data.mastered ?? 0) / reviewedPool) * 100) : 0;

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

    const maxForecast = Math.max(...forecastBuckets.map((bucket) => bucket.count), 1);

    const recentWords = [...vocabItems]
      .sort((a, b) => {
        const dateA = safeDate(a.next_review_date)?.getTime() ?? 0;
        const dateB = safeDate(b.next_review_date)?.getTime() ?? 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    return {
      dueToday,
      retentionRate,
      forecastBuckets,
      maxForecast,
      recentWords,
    };
  }, [stats, vocabItems]);

  if (loading) {
    return (
      <div className="panel rounded-3xl p-8 text-center text-sm text-slate-600">
        Dang tai Learning Hub...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="panel rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f4c5c] text-white">
              <Languages size={20} />
            </span>
            <div>
              <h1 className="text-3xl">Learning Hub</h1>
              <p className="text-sm text-slate-600">
                Xin chao {profile?.full_name || "ban"}, day la trung tam hoc tap hom nay.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/vocab"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <BookOpenCheck size={16} />
              Vocabulary Hub
            </Link>
            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <BrainCircuit size={16} />
              Practice Room
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="panel rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Saved words</p>
          <p className="mt-2 text-4xl">{stats?.data.total_words ?? 0}</p>
        </article>
        <article className="panel rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Learning</p>
          <p className="mt-2 text-4xl text-[#006d77]">{stats?.data.learning ?? 0}</p>
        </article>
        <article className="panel rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mastered</p>
          <p className="mt-2 text-4xl text-[#ff7f50]">{stats?.data.mastered ?? 0}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-5">
          <article className="panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Review forecast
                </p>
                <h2 className="mt-1 text-2xl">So tu den han trong 7 ngay toi</h2>
              </div>
              <CalendarClock className="text-[#0f4c5c]" size={20} />
            </div>

            <div className="mt-6 grid grid-cols-7 items-end gap-3">
              {metrics.forecastBuckets.map((bucket) => {
                const height = Math.max((bucket.count / metrics.maxForecast) * 100, 6);
                return (
                  <div key={bucket.dateKey} className="text-center">
                    <div className="mx-auto flex h-36 w-full items-end justify-center rounded-xl bg-slate-100/70 px-1 pb-1">
                      <div
                        className="w-full rounded-md bg-[#0f4c5c] transition-all"
                        style={{ height: `${height}%` }}
                        title={`${bucket.count} words`}
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-600">{bucket.dayLabel}</p>
                    <p className="text-xs text-slate-500">{bucket.count}</p>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <div className="space-y-5">
          <article className="panel rounded-3xl p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Nhiem vu hom nay
            </p>
            <h2 className="mt-1 text-2xl">Call-to-Action Metrics</h2>

            <div className="mt-5 rounded-2xl bg-[#0f4c5c] p-5 text-white">
              <p className="text-sm text-white/80">Due for review</p>
              <p className="mt-2 text-5xl font-semibold">{metrics.dueToday}</p>
              <p className="mt-1 text-sm text-white/80">tu can on ngay hom nay</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-900/10 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-700">Retention rate</p>
              <p className="mt-2 text-3xl font-semibold text-[#0f4c5c]">{metrics.retentionRate}%</p>
              <p className="mt-1 text-xs text-slate-500">
                Uoc tinh theo ty le mastered tren tong hoc (learning + mastered).
              </p>
            </div>

            <Link
              href="/practice"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#ff7f50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#f59a74]"
            >
              Vao phong tap ngay
            </Link>
          </article>
        </div>
      </section>

      <section className="panel rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Recently added
            </p>
            <h2 className="mt-1 text-2xl">5 tu vua duoc luu gan day</h2>
          </div>
          <Award className="text-[#0f4c5c]" size={18} />
        </div>

        {partialDataNote && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {partialDataNote}
          </p>
        )}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-900/10">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-100/70 text-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Word</th>
                <th className="px-4 py-3 font-semibold">Vietnamese</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/10 bg-white/75">
              {metrics.recentWords.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Chua co tu du lieu de hien thi.
                  </td>
                </tr>
              )}
              {metrics.recentWords.map((item, index) => (
                <tr key={`${item.word}-${index}`} className="align-top">
                  <td className="px-4 py-3 font-semibold text-[#0f4c5c]">{item.word}</td>
                  <td className="px-4 py-3 text-slate-700">{item.translation || "-"}</td>
                  <td className="max-w-xl px-4 py-3 text-slate-600">
                    <p className="line-clamp-2">{item.context || "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
