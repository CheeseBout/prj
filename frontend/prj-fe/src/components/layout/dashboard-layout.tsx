"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  LogOut,
  UserRound,
  ArrowRight,
  Layers,
} from "lucide-react";

import { logout } from "@/lib/api";

import { getTags, TagOption } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/vocab", label: "Vocabulary", icon: BookOpenCheck },
  { href: "/collections", label: "Collections", icon: Layers },
  { href: "/practice", label: "Practice", icon: BrainCircuit },
  { href: "/profile", label: "Profile", icon: UserRound },
];

interface DashboardLayoutShellProps {
  children: ReactNode;
}

export const DashboardLayoutShell = ({
  children,
}: DashboardLayoutShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [topTags, setTopTags] = React.useState<TagOption[]>([]);

  React.useEffect(() => {
    getTags()
      .then((res) => {
        if (res.data) {
          // Sort by word_count descending and take top 5
          const sorted = [...res.data].sort((a, b) => b.word_count - a.word_count).slice(0, 5);
          setTopTags(sorted);
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar (Desktop) ───────────────────────────────────── */}
      <aside className="hidden w-64 flex-col border-r border-foreground/10 lg:flex">
        <div className="p-6">
          <Link href="/">
            <span className="font-serif text-xl font-bold tracking-tight">
              Lexi<span className="text-accent">Bridge</span>
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <React.Fragment key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      isActive
                        ? "text-background"
                        : "text-foreground/40 transition group-hover:text-foreground/70"
                    }
                  />
                  {item.label}
                </Link>
                {/* Render Collections submenu under Collections */}
                {item.href === "/collections" && (
                  <div className="mb-2 mt-1 flex flex-col gap-1 pl-11 pr-4">
                    {topTags.map((tag) => (
                      <Link
                        key={tag.tag}
                        href={`/vocab?tag=${encodeURIComponent(tag.tag)}`}
                        className="group flex items-center justify-between rounded-sm px-2 py-1.5 text-xs font-medium text-foreground/50 hover:bg-foreground/5 hover:text-foreground transition"
                      >
                        <span>#{tag.tag}</span>
                        <span className="text-[10px] text-foreground/30 group-hover:text-foreground/50 transition">
                          {tag.word_count}
                        </span>
                      </Link>
                    ))}
                    {topTags.length === 0 && (
                      <span className="text-xs text-foreground/30 italic px-2 py-1">No collections yet</span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="border-t border-foreground/10 p-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="group flex w-full items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium text-foreground/55 transition hover:bg-foreground/5 hover:text-foreground"
          >
            <LogOut
              size={18}
              className="text-foreground/40 transition group-hover:text-foreground/70"
            />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="animate-in mx-auto max-w-7xl px-4 py-8 md:px-6">
          {children}
        </div>
      </main>

      {/* ── Mobile Tab Bar ──────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-between border-t border-foreground/10 bg-[rgba(250,249,246,0.92)] backdrop-blur-md lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wider transition ${
                isActive
                  ? "text-accent"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
