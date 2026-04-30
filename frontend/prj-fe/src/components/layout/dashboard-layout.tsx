"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  LogOut,
  UserRound,
} from "lucide-react";

import { logout } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/vocab", label: "Vocabulary", icon: BookOpenCheck },
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
              <Link
                key={item.href}
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
