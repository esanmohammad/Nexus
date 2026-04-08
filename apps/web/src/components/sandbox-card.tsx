"use client";

import Link from "next/link";
import { StatusBadge } from "./status-badge";

interface Sandbox {
  id: string;
  name: string;
  state: string;
  cloud_run_url?: string;
  current_version?: number;
  owner_email: string;
  expires_at: string;
  updated_at: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function expiryCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expired";
  return `${days}d remaining`;
}

function stateBorderColor(state: string): string {
  switch (state) {
    case "running":
      return "border-l-success";
    case "sleeping":
      return "border-l-warning";
    case "failed":
    case "destroy_failed":
      return "border-l-danger";
    case "creating":
    case "destroying":
      return "border-l-accent";
    default:
      return "border-l-text-muted";
  }
}

function stateBgTint(state: string): string {
  switch (state) {
    case "failed":
    case "destroy_failed":
      return "bg-danger/[0.03]";
    case "running":
      return "bg-success/[0.02]";
    default:
      return "";
  }
}

export function SandboxCard({ sandbox }: { sandbox: Sandbox }) {
  const url = sandbox.cloud_run_url;

  return (
    <Link href={`/sandboxes/${sandbox.id}`} className="block group">
      <div
        className={`glass rounded-l-sm rounded-r-2xl border-l-[3px] ${stateBorderColor(sandbox.state)} ${stateBgTint(sandbox.state)} p-5 hover:border-accent/30 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] group-hover:scale-[1.02] group-hover:-translate-y-0.5 transition-all duration-200 min-h-[12rem] flex flex-col`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary group-hover:text-white">
              {sandbox.name}
            </h3>
            {sandbox.current_version && (
              <p className="text-xs text-text-muted mt-0.5">
                v{sandbox.current_version} &middot; {relativeTime(sandbox.updated_at)}
              </p>
            )}
          </div>
          <StatusBadge status={sandbox.state} />
        </div>

        {/* Always reserve space for URL row */}
        <p className="text-xs truncate font-mono mb-3 h-4">
          {url ? (
            <span className="text-cyan/60">{url}</span>
          ) : (
            <span className="text-text-muted">Not deployed yet</span>
          )}
        </p>

        {/* Push footer to bottom */}
        <div className="flex items-center justify-between pt-3 border-t border-glass-border mt-auto">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
            {expiryCountdown(sandbox.expires_at)}
          </span>
          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-3 py-2 min-h-[44px] flex items-center rounded-xl glass text-text-secondary hover:text-text-primary transition-colors"
              >
                Open
              </a>
            )}
            <Link
              href={`/sandboxes/${sandbox.id}/deploy`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-2 min-h-[44px] flex items-center rounded-xl bg-accent/20 text-accent hover:bg-accent/30 font-medium transition-colors"
            >
              Deploy
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
}
