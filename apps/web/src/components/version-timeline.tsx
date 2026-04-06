"use client";

import { StatusBadge } from "./status-badge";

interface Version {
  number: number;
  label?: string;
  status: string;
  deployed_by: string;
  created_at: string;
}

interface Props {
  versions: Version[];
  onRollback?: (targetVersion: number) => void;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function VersionTimeline({ versions, onRollback }: Props) {
  const sorted = [...versions].sort((a, b) => b.number - a.number);

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {sorted.map((version) => {
          const isLive = version.status === "live";
          const isFailed = version.status === "failed";
          const canRollback = !isLive && !isFailed;

          return (
            <div key={version.number} className="relative flex items-start gap-4 pl-8">
              <div
                className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 ${
                  isLive
                    ? "bg-green-500 border-green-500"
                    : isFailed
                      ? "bg-red-500 border-red-500"
                      : "bg-white border-gray-300"
                }`}
              />

              <div className="flex-1 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      v{version.number}
                    </span>
                    {version.label && (
                      <span className="text-xs text-gray-500">
                        {version.label}
                      </span>
                    )}
                    <StatusBadge status={version.status} />
                  </div>

                  {canRollback && onRollback && (
                    <button
                      onClick={() => onRollback(version.number)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 min-h-[44px]"
                    >
                      Roll back to this version
                    </button>
                  )}

                  {isFailed && (
                    <span className="text-xs text-red-500">&#10007; Error</span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {version.deployed_by} &middot; {relativeTime(version.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
