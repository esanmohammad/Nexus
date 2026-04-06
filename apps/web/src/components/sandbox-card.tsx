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
  return `Expires in ${days} days`;
}

export function SandboxCard({ sandbox }: { sandbox: Sandbox }) {
  const url = sandbox.cloud_run_url;
  const truncatedUrl = url && url.length > 40 ? url.slice(0, 40) + "..." : url;

  return (
    <Link href={`/sandboxes/${sandbox.id}`} className="block">
      <div className="rounded-lg border border-gray-200 p-4 hover:border-gray-400 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{sandbox.name}</h3>
          <StatusBadge status={sandbox.state} />
        </div>

        {sandbox.current_version && (
          <p className="text-sm text-gray-500">
            v{sandbox.current_version} &middot; {sandbox.owner_email} &middot;{" "}
            {relativeTime(sandbox.updated_at)}
          </p>
        )}

        {truncatedUrl && (
          <p className="text-sm text-blue-600 mt-1 truncate">{truncatedUrl}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {expiryCountdown(sandbox.expires_at)}
          </span>
          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 min-h-[44px] flex items-center"
              >
                Open
              </a>
            )}
            <Link
              href={`/sandboxes/${sandbox.id}/deploy`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 min-h-[44px] flex items-center"
            >
              Deploy
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
}
