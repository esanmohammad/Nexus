"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SandboxCard } from "../components/sandbox-card";
import { API_BASE, getSession, useAuth } from "../lib/auth";

function HeroLanding() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center text-center px-4">
      {/* Glowing orb */}
      <div className="relative mb-10">
        <div className="absolute inset-0 w-32 h-32 rounded-full bg-accent/20 blur-[60px]" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-accent via-indigo-400 to-cyan flex items-center justify-center glow-accent">
          <span className="text-white font-bold text-4xl tracking-tighter">N</span>
        </div>
      </div>

      <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-white via-white to-text-secondary bg-clip-text text-transparent">
          Ship anything.
        </span>
        <br />
        <span className="bg-gradient-to-r from-accent via-indigo-400 to-cyan bg-clip-text text-transparent">
          Instantly.
        </span>
      </h1>

      <p className="mt-6 text-lg text-text-secondary max-w-md leading-relaxed">
        Nexus turns your code into live sandboxes in seconds.
        Deploy, share, iterate &mdash; no infra required.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <Link
          href="/login"
          className="px-8 py-3.5 rounded-full bg-gradient-to-r from-accent to-indigo-400 text-white font-semibold text-sm hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all glow-accent"
        >
          Get started
        </Link>
        <a
          href="https://github.com/esanmohammad/Nexus"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3.5 rounded-full glass text-text-secondary font-medium text-sm hover:text-text-primary transition-colors"
        >
          View on GitHub
        </a>
      </div>

      {/* Feature pills */}
      <div className="mt-16 flex flex-wrap justify-center gap-3">
        {[
          "ZIP to sandbox in seconds",
          "Version rollback",
          "Team sharing",
          "Custom domains",
          "Postgres databases",
          "GitHub auto-deploy",
        ].map((feature) => (
          <span
            key={feature}
            className="glass rounded-full px-4 py-2 text-xs text-text-muted font-medium"
          >
            {feature}
          </span>
        ))}
      </div>
    </div>
  );
}

type StatusFilter = "all" | "running" | "sleeping" | "failed";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "sleeping", label: "Sleeping" },
  { key: "failed", label: "Failed" },
];

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { data: sandboxes, isLoading } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: async () => {
      const token = getSession();
      if (!token) return [];
      const res = await fetch(`${API_BASE}/api/sandboxes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.sandboxes || data;
    },
    enabled: isAuthenticated,
  });

  const filtered = useMemo(() => {
    if (!sandboxes) return [];
    let list = [...sandboxes].sort(
      (a: any, b: any) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    if (statusFilter !== "all") {
      list = list.filter((s: any) => s.state === statusFilter);
    }
    if (search) {
      list = list.filter((s: any) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return list;
  }, [sandboxes, search, statusFilter]);

  // Status counts
  const counts = useMemo(() => {
    if (!sandboxes) return { total: 0, running: 0, sleeping: 0, failed: 0 };
    return {
      total: sandboxes.length,
      running: sandboxes.filter((s: any) => s.state === "running").length,
      sleeping: sandboxes.filter((s: any) => s.state === "sleeping").length,
      failed: sandboxes.filter((s: any) => s.state === "failed").length,
    };
  }, [sandboxes]);

  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (index + 1) % FILTERS.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (index - 1 + FILTERS.length) % FILTERS.length;
      }
      if (nextIndex !== null) {
        setStatusFilter(FILTERS[nextIndex].key);
        chipRefs.current[nextIndex]?.focus();
      }
    },
    []
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <HeroLanding />;
  }

  const isFiltered = search || statusFilter !== "all";

  return (
    <div className="min-h-screen">
      {/* Compact heading section */}
      <section className="pt-8 pb-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-text-primary">Sandboxes</h1>
            {sandboxes && sandboxes.length > 0 && (
              <span className="text-sm text-text-secondary">
                {counts.total} total{counts.running > 0 ? ` \u00b7 ${counts.running} running` : ""}
                {counts.sleeping > 0 ? ` \u00b7 ${counts.sleeping} sleeping` : ""}
              </span>
            )}
          </div>
          <Link
            href="/sandboxes/new"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-indigo-400 text-white font-semibold text-sm hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] glow-accent transition-all whitespace-nowrap"
          >
            + New Sandbox
          </Link>
        </div>
      </section>

      <section>
        {/* Full-width search bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search sandboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted border border-glass-border bg-transparent"
          />
        </div>

        {/* Left-aligned filter chips with ARIA tabs */}
        <div className="mb-6 flex justify-start gap-2" role="tablist">
          {FILTERS.map(({ key, label }, index) => (
            <button
              key={key}
              ref={(el) => { chipRefs.current[index] = el; }}
              role="tab"
              aria-selected={statusFilter === key}
              tabIndex={statusFilter === key ? 0 : -1}
              onClick={() => setStatusFilter(key)}
              onKeyDown={(e) => handleChipKeyDown(e, index)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                statusFilter === key
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "glass text-text-muted hover:text-text-secondary"
              }`}
            >
              {label}
              {key !== "all" && counts[key] > 0 && (
                <span className="ml-1.5 text-text-muted">{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-5 h-48 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          isFiltered ? (
            /* Filtered empty state — no CTA */
            <div className="text-center py-20">
              <p className="text-text-muted text-sm">
                No sandboxes match your filters.
              </p>
            </div>
          ) : (
            /* True empty state */
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-accent/20 to-cyan/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">Launch your first sandbox</h2>
              <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
                Upload a ZIP or connect a GitHub repo — Nexus handles the rest.
              </p>
              <Link
                href="/sandboxes/new"
                className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-indigo-400 text-white font-semibold text-sm hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] glow-accent transition-all"
              >
                Create sandbox
              </Link>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sandbox: any) => (
              <SandboxCard key={sandbox.id} sandbox={sandbox} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
