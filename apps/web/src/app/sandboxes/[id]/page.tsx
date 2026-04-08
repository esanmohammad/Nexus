"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { StatusBadge } from "../../../components/status-badge";
import { VersionTimeline } from "../../../components/version-timeline";
import { ShareDialog } from "../../../components/share-dialog";
import { TtlSlider } from "../../../components/ttl-slider";
import { useToast } from "../../../components/toast";
import { API_BASE, getSession } from "../../../lib/auth";

function authHeaders() {
  return { Authorization: `Bearer ${getSession()}` };
}

export default function SandboxDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showShare, setShowShare] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendTtl, setExtendTtl] = useState(7);
  const [confirmDestroy, setConfirmDestroy] = useState("");
  const [showDestroy, setShowDestroy] = useState(false);

  const { data: sandbox, isLoading } = useQuery({
    queryKey: ["sandbox", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}`, {
        headers: authHeaders(),
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
        headers: authHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.versions || data;
    },
  });

  async function handleRollback(targetVersion: number) {
    try {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}/rollback`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ target_version: targetVersion }),
      });
      if (!res.ok) throw new Error("Rollback failed");
      queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
      queryClient.invalidateQueries({ queryKey: ["versions", id] });
      toast(`Rolled back to v${targetVersion}`, "success");
    } catch {
      toast("Rollback failed", "error");
    }
  }

  async function handleExtend() {
    try {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}/extend`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ttl_days: extendTtl }),
      });
      if (!res.ok) throw new Error("Extend failed");
      queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
      setShowExtend(false);
      toast(`Extended TTL by ${extendTtl} days`, "success");
    } catch {
      toast("Failed to extend TTL", "error");
    }
  }

  async function handleDestroy() {
    try {
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Destroy failed");
      toast("Sandbox destroyed", "success");
      window.location.href = "/";
    } catch {
      toast("Failed to destroy sandbox", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!sandbox) {
    return <div className="text-center py-20 text-text-muted">Sandbox not found</div>;
  }

  const expiryDays = Math.ceil(
    (new Date(sandbox.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-accent hover:underline mb-6 inline-block">
        &larr; Back to dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-text-primary">{sandbox.name}</h1>
          <StatusBadge status={sandbox.state} />
        </div>
      </div>

      {sandbox.cloud_run_url && (
        <div className="flex items-center gap-2 mb-6 p-4 glass rounded-xl">
          <span className="text-sm text-cyan/70 font-mono truncate flex-1">
            {sandbox.cloud_run_url}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(sandbox.cloud_run_url)}
            className="text-xs px-3 py-2 glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
          >
            Copy
          </button>
          <a
            href={sandbox.cloud_run_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-2 bg-accent/20 text-accent rounded-xl hover:bg-accent/30 font-medium transition-colors"
          >
            Open
          </a>
        </div>
      )}

      <p className="text-sm text-text-muted mb-6">
        v{sandbox.current_version} &middot; {sandbox.owner_email}
      </p>

      <div className="flex gap-2 mb-8">
        <Link
          href={`/sandboxes/${id}/deploy`}
          className="px-6 py-3 text-sm bg-gradient-to-r from-accent to-indigo-400 text-white rounded-xl hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] font-semibold glow-accent transition-all"
        >
          Deploy new version
        </Link>
        <button
          onClick={() => setShowShare(true)}
          className="text-xs px-3 py-2 glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
        >
          Share
        </button>
        <button
          onClick={() => setShowExtend(!showExtend)}
          className="text-xs px-3 py-2 glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
        >
          Extend
        </button>
      </div>

      {/* Animated Extend TTL expansion */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out mb-6"
        style={{ gridTemplateRows: showExtend ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="p-5 glass rounded-xl mt-2">
            <h3 className="text-sm font-medium text-text-primary mb-2">Extend TTL</h3>
            <p className="text-xs text-text-muted mb-3">
              Current expiry: {new Date(sandbox.expires_at).toLocaleDateString()} ({expiryDays} days remaining)
            </p>
            <TtlSlider value={extendTtl} onChange={setExtendTtl} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleExtend}
                className="px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
              >
                Extend
              </button>
              <button
                onClick={() => setShowExtend(false)}
                className="px-4 py-2 text-sm glass rounded-xl text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Version Timeline
        </h2>
        {versions && versions.length > 0 ? (
          <VersionTimeline versions={versions} onRollback={handleRollback} />
        ) : (
          <p className="text-sm text-text-muted">No version history yet.</p>
        )}
      </section>

      {/* Danger Zone */}
      <section className="mt-8">
        <div className="border border-danger/20 rounded-2xl p-5 bg-danger/[0.03]">
          <h2 className="text-sm font-semibold text-danger mb-1">Danger Zone</h2>
          <p className="text-xs text-text-muted mb-3">
            Permanently destroy this sandbox, all versions, and associated resources.
          </p>
          <button
            onClick={() => setShowDestroy(!showDestroy)}
            className="px-4 py-2 text-sm border border-danger/30 text-danger rounded-xl hover:bg-danger/10 transition-colors"
          >
            Destroy sandbox...
          </button>

          {/* Animate the confirmation */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: showDestroy ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-danger/10">
                <p className="text-sm text-text-secondary mb-3">
                  Type <strong className="text-text-primary">{sandbox.name}</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmDestroy}
                  onChange={(e) => setConfirmDestroy(e.target.value)}
                  className="glass rounded-xl px-3 py-2 text-sm w-full mb-3 bg-transparent text-text-primary border border-glass-border transition-colors"
                />
                <button
                  onClick={handleDestroy}
                  disabled={confirmDestroy !== sandbox.name}
                  className={`px-4 py-2 text-sm rounded-xl transition-all ${
                    confirmDestroy === sandbox.name
                      ? "bg-danger text-white hover:bg-danger/90 cursor-pointer"
                      : "bg-text-muted/20 text-text-muted cursor-not-allowed"
                  }`}
                  >
                  Destroy permanently
                </button>
              </div>
            </div>
          </div>
        </div>
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
