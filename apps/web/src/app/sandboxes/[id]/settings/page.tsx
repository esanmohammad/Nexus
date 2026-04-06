"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { TtlSlider } from "../../../../components/ttl-slider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function SettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [ttl, setTtl] = useState(7);
  const [success, setSuccess] = useState(false);

  const { data: sandbox } = useQuery({
    queryKey: ["sandbox", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  async function handleExtend() {
    await fetch(`${API_BASE}/api/sandboxes/${id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ttl_days: ttl }),
    });
    queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  const expiryDays = sandbox
    ? Math.ceil(
        (new Date(sandbox.expires_at).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      )
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/sandboxes/${id}`}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        &larr; Back to {sandbox?.name || "sandbox"}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Extend TTL</h2>
        {sandbox && (
          <p className="text-sm text-gray-500 mb-4">
            Current expiry: {new Date(sandbox.expires_at).toLocaleDateString()}{" "}
            ({expiryDays} days remaining)
          </p>
        )}
        <TtlSlider value={ttl} onChange={setTtl} />
        <button
          onClick={handleExtend}
          className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px]"
        >
          Extend
        </button>
        {success && (
          <p className="text-sm text-green-600 mt-2">TTL extended!</p>
        )}
      </section>
    </div>
  );
}
