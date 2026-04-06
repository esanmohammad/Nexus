"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SandboxCard } from "../components/sandbox-card";
import { DeployDropzone } from "../components/deploy-dropzone";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function DashboardPage() {
  const [search, setSearch] = useState("");

  const { data: sandboxes, isLoading } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/sandboxes`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
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

  return (
    <div className="min-h-screen">
      {/* Nexus Dashboard */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900">
          What do you want to ship?
        </h1>
        <p className="mt-2 text-gray-500">
          Drop a ZIP to create a sandbox instantly
        </p>
        <div className="mt-6 max-w-md mx-auto">
          <DeployDropzone onFileSelect={handleFileDrop} />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search sandboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm min-h-[44px]"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No sandboxes yet. Drop a ZIP to create your first one.
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
