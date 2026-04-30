"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpenCheck,
  GraduationCap,
  Languages,
  Settings,
  Shield,
} from "lucide-react";

import { getMe, getVocabStats, updateMe, UserResponse, VocabStats } from "@/lib/api";

export const ProfileClient = () => {
  const router = useRouter();
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    major: "",
    english_level: "",
  });
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [me, vocabStats] = await Promise.all([getMe(), getVocabStats()]);
      setProfile(me);
      setStats(vocabStats);
      setEditForm({
        full_name: me.full_name || "",
        major: me.major || "",
        english_level: me.english_level || "",
      });
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMe({
        full_name: editForm.full_name || undefined,
        major: editForm.major || undefined,
        english_level: editForm.english_level || undefined,
      });
      setProfile(updated);
      setEditing(false);
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="editorial-meta animate-pulse">Loading profile...</p>
      </div>
    );
  }

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const settingsRows = [
    {
      icon: Languages,
      label: "English level",
      value: profile?.english_level || "Not set",
    },
    {
      icon: GraduationCap,
      label: "Major",
      value: profile?.major || "Not set",
    },
    {
      icon: Shield,
      label: "Role",
      value: profile?.role || "User",
    },
    {
      icon: Settings,
      label: "Account created",
      value: profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString()
        : "-",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="editorial-meta">Account</p>
        <h1 className="mt-2 font-serif text-4xl">
          Profile<em className="italic">.</em>
        </h1>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        {/* ── Left Sidebar: Info ───────────────────────────────── */}
        <div className="flex flex-col items-center border border-foreground/10 p-8 md:col-span-1">
          {/* Avatar */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-foreground/10 bg-foreground/5">
            <span className="font-serif text-2xl font-bold text-foreground/50">
              {initials}
            </span>
          </div>

          <h2 className="mt-5 text-center font-serif text-xl">
            {profile?.full_name || "Unknown"}
          </h2>
          <p className="mt-1 text-xs text-foreground/40">{profile?.email}</p>

          {/* Badge */}
          <span className="mt-4 rounded-full border border-foreground/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
            {profile?.role || "User"}
          </span>
        </div>

        {/* ── Right Main: Stats & Settings ─────────────────────── */}
        <div className="space-y-6 md:col-span-2">
          {/* Mini Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-foreground/10 p-6">
              <p className="editorial-meta">Total words</p>
              <p className="mt-2 font-serif text-3xl">
                {stats?.data.total_words ?? 0}
              </p>
            </div>
            <div className="border border-foreground/10 p-6">
              <p className="editorial-meta">Mastered</p>
              <p className="mt-2 font-serif text-3xl text-accent">
                {stats?.data.mastered ?? 0}
              </p>
            </div>
          </div>

          {/* Settings List */}
          <div className="divide-y divide-foreground/10 border border-foreground/10">
            {settingsRows.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-6"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-foreground/30" />
                    <span className="text-sm font-medium">{row.label}</span>
                  </div>
                  <span className="text-sm text-foreground/50">{row.value}</span>
                </div>
              );
            })}
          </div>

          {/* Edit Section */}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full border border-foreground/10 py-3 text-sm font-semibold transition hover:bg-foreground/5"
            >
              Edit profile
            </button>
          ) : (
            <div className="space-y-4 border border-foreground/10 p-6">
              <div>
                <label className="editorial-meta mb-2 block text-foreground/60">
                  Full name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      full_name: e.target.value,
                    }))
                  }
                  className="w-full border-b border-foreground/15 bg-transparent pb-2 text-sm outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="editorial-meta mb-2 block text-foreground/60">
                  Major
                </label>
                <input
                  type="text"
                  value={editForm.major}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      major: e.target.value,
                    }))
                  }
                  className="w-full border-b border-foreground/15 bg-transparent pb-2 text-sm outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="editorial-meta mb-2 block text-foreground/60">
                  English level
                </label>
                <select
                  value={editForm.english_level}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      english_level: e.target.value,
                    }))
                  }
                  className="w-full border-b border-foreground/15 bg-transparent pb-2 text-sm outline-none transition focus:border-accent"
                >
                  <option value="">Not set</option>
                  <option value="A1-A2">A1-A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 border border-foreground/10 py-3 text-sm font-semibold transition hover:bg-foreground/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="flex-1 bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/85 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
