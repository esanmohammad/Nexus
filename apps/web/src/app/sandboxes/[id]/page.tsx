"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { StatusBadge } from "../../../components/status-badge";
import { VersionTimeline } from "../../../components/version-timeline";
import { ShareDialog } from "../../../components/share-dialog";
import { TtlSlider } from "../../../components/ttl-slider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function SandboxDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [showShare, setShowShare] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendTtl, setExtendTtl] = useState(7);
  const [confirmDestroy, setConfirmDestroy] = useState("");
  const [showDestroy, setShowDestroy] = useState(false);

  const { data: sandbox, isLoading } = useQuery({
    queryKey: ["sandbox", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });

  const { data: versions } = useQuery({
    queryKey: ["versions", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}/versions`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleRollback(targetVersion: number) {
    await fetch(`${API_BASE}/api/sandboxes/${id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ target_version: targetVersion }),
    });
    queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
    queryClient.invalidateQueries({ queryKey: ["versions", id] });
  }

  async function handleExtend() {
    await fetch(`${API_BASE}/api/sandboxes/${id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ttl_days: extendTtl }),
    });
    queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
    setShowExtend(false);
  }

  async function handleDestroy() {
    await fetch(`${API_BASE}/api/sandboxes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    window.location.href = "/";
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Loading...</div>;
  }

  if (!sandbox) {
    return <div className="text-center py-8 text-gray-400">Sandbox not found</div>;
  }

  const expiryDays = Math.ceil(
    (new Date(sandbox.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{sandbox.name}</h1>
          <StatusBadge status={sandbox.state} />
        </div>
      </div>

      {sandbox.cloud_run_url && (
        <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600 truncate flex-1">
            {sandbox.cloud_run_url}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(sandbox.cloud_run_url)}
            className="text-xs px-2 py-1 border rounded hover:bg-gray-100 min-h-[44px]"
          >
            Copy
          </button>
          <a
            href={sandbox.cloud_run_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px] flex items-center"
          >
            Open in new tab
          </a>
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <p className="text-sm text-gray-500">
          v{sandbox.current_version} &middot; {sandbox.owner_email}
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        <Link
          href={`/sandboxes/${id}/deploy`}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px] flex items-center"
        >
          Deploy new version
        </Link>
        <button
          onClick={() => setShowShare(true)}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-50 min-h-[44px]"
        >
          Share
        </button>
        <button
          onClick={() => setShowExtend(true)}
          className="px-4 py-2 text-sm border rounded hover:bg-gray-50 min-h-[44px]"
        >
          Extend
        </button>
      </div>

      {showExtend && (
        <div className="mb-6 p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-2">Extend TTL</h3>
          <p className="text-xs text-gray-500 mb-3">
            Current expiry: {new Date(sandbox.expires_at).toLocaleDateString()} ({expiryDays} days remaining)
          </p>
          <TtlSlider value={extendTtl} onChange={setExtendTtl} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleExtend}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px]"
            >
              Extend
            </button>
            <button
              onClick={() => setShowExtend(false)}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Version Timeline
        </h2>
        {versions && versions.length > 0 ? (
          <VersionTimeline versions={versions} onRollback={handleRollback} />
        ) : (
          <p className="text-sm text-gray-400">No versions yet.</p>
        )}
      </section>

      <section className="border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Expires: {new Date(sandbox.expires_at).toLocaleDateString()} ({expiryDays} days remaining)
        </p>

        <button
          onClick={() => setShowDestroy(!showDestroy)}
          className="text-sm text-red-600 hover:underline"
        >
          Destroy sandbox
        </button>

        {showDestroy && (
          <div className="mt-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <p className="text-sm text-red-800 mb-2">
              Type <strong>{sandbox.name}</strong> to confirm destruction:
            </p>
            <input
              type="text"
              value={confirmDestroy}
              onChange={(e) => setConfirmDestroy(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full mb-2 min-h-[44px]"
            />
            <button
              onClick={handleDestroy}
              disabled={confirmDestroy !== sandbox.name}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
            >
              Destroy
            </button>
          </div>
        )}
      </section>

      {showShare && (
        <ShareDialog
          sandboxId={id}
          sandboxUrl={sandbox.cloud_run_url || ""}
          currentMode={sandbox.access_mode || "owner_only"}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
