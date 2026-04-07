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

export function SandboxCard({ sandbox }: { sandbox: Sandbox }) {
  const url = sandbox.cloud_run_url;

  return (
    <Link href={`/sandboxes/${sandbox.id}`} className="block group">
      <div className="glass rounded-2xl p-5 hover:border-accent/30 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all duration-300">
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

        {url && (
          <p className="text-xs text-cyan/60 truncate font-mono mb-3">{url}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-glass-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
            {expiryCountdown(sandbox.expires_at)}
          </span>
          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-3 py-1.5 rounded-lg glass text-text-secondary hover:text-text-primary"
              >
                Open
              </a>
            )}
            <Link
              href={`/sandboxes/${sandbox.id}/deploy`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 font-medium"
            >
              Deploy
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
}
