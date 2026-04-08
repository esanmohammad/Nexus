"use client";

import Link from "next/link";
import { useAuth, logout } from "../lib/auth";

export function Header() {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <header className="glass border-b border-glass-border sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-cyan flex items-center justify-center glow-accent">
            <span className="text-white font-bold text-sm">N</span>
          </div>
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            Nexus
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-20 h-4 rounded bg-glass animate-pulse" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full glass">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-cyan flex items-center justify-center text-[10px] font-bold text-white">
                  {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <span className="text-sm text-text-secondary">
                  {user.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-text-muted hover:text-text-secondary px-2 py-1 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm px-5 py-2 rounded-full bg-gradient-to-r from-accent to-indigo-400 text-white font-medium hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all glow-accent"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
