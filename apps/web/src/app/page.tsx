"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SandboxCard } from "../components/sandbox-card";
import { DeployDropzone } from "../components/deploy-dropzone";
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
          className="px-8 py-3.5 rounded-full bg-gradient-to-r from-accent to-indigo-400 text-white font-semibold text-sm hover:opacity-90 glow-accent"
        >
          Get started
        </Link>
        <a
          href="https://github.com/esanmohammad/Nexus"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3.5 rounded-full glass text-text-secondary font-medium text-sm hover:text-text-primary"
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

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState("");

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
    const sorted = [...sandboxes].sort(
      (a: any, b: any) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    if (!search) return sorted;
    return sorted.filter((s: any) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [sandboxes, search]);

  function handleFileDrop(file: File) {
    window.location.href = `/sandboxes/new?file=${encodeURIComponent(file.name)}`;
  }

  // Show loading skeleton briefly
  if (authLoading) {
    return <div className="min-h-screen" />;
  }

  // Not logged in — show hero landing
  if (!isAuthenticated) {
    return <HeroLanding />;
  }

  // Logged in — show dashboard
  return (
    <div className="min-h-screen">
      {/* Nexus Dashboard */}
      <section className="text-center pt-16 pb-12">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-text-primary via-text-primary to-text-secondary bg-clip-text text-transparent">
          What do you want to ship?
        </h1>
        <p className="mt-3 text-text-secondary text-lg">
          Drop a ZIP to create a sandbox instantly
        </p>
        <div className="mt-8 max-w-lg mx-auto">
          <DeployDropzone onFileSelect={handleFileDrop} />
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-6 flex justify-center">
          <input
            type="text"
            placeholder="Search sandboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted border border-glass-border bg-transparent text-center"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">
              No sandboxes yet. Drop a ZIP above to create your first one.
            </p>
          </div>
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
