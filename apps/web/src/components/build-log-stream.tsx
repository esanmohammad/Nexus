"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  sandboxId: string;
  versionNumber: number;
  status: string;
}

export function BuildLogStream({ sandboxId, versionNumber, status }: Props) {
  const [log, setLog] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (status !== "building") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/sandboxes/${sandboxId}/versions/${versionNumber}/log`,
          { credentials: "include" }
        );
        if (res.ok) {
          const text = await res.text();
          setLog(text);
        }
      } catch {
        // ignore fetch errors during polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sandboxId, versionNumber, status, API_BASE]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [log]);

  const lines = log.split("\n").filter(Boolean);
  const isBuilding = status === "building";
  const isDone = status === "live" || status === "failed";
  const isFailed = status === "failed";

  return (
    <div className="rounded-2xl border border-glass-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border bg-glass">
        <div className="flex items-center gap-2">
          {/* Terminal icon */}
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">Build Log</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isBuilding && (
            <>
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <span className="text-xs font-medium text-warning">Building</span>
            </>
          )}
          {status === "live" && (
            <>
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-medium text-success">Complete</span>
            </>
          )}
          {isFailed && (
            <>
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-xs font-medium text-danger">Failed</span>
            </>
          )}
        </div>
      </div>

      {/* Log body */}
      <div
        ref={containerRef}
        className="overflow-auto max-h-80 p-4 space-y-0.5"
      >
        {lines.length > 0 ? (
          lines.map((line, i) => {
            const isLastLine = i === lines.length - 1;
            const isActiveLine = isBuilding && isLastLine;
            const isCompletedLine = isDone ? true : i < lines.length - 1;
            const isFailedLine = isFailed && isLastLine;

            return (
              <div
                key={i}
                className={`flex items-start gap-3 py-1.5 px-3 rounded-lg font-mono text-[13px] leading-relaxed ${
                  isActiveLine
                    ? "bg-warning/10 text-warning"
                    : isFailedLine
                    ? "bg-danger/10 text-danger"
                    : isCompletedLine
                    ? "text-text-secondary"
                    : "text-text-muted"
                }`}
              >
                {/* Step indicator */}
                <span className="shrink-0 w-5 text-right select-none">
                  {isFailedLine ? (
                    <span className="text-danger">✗</span>
                  ) : isActiveLine ? (
                    <span className="inline-block animate-spin text-warning">⟳</span>
                  ) : isCompletedLine && !isBuilding ? (
                    <span className="text-success">✓</span>
                  ) : (
                    <span className="text-text-muted">{i + 1}</span>
                  )}
                </span>

                {/* Log content */}
                <span className="flex-1 break-words">{line}</span>

                {/* Step counter */}
                <span className="shrink-0 text-text-muted/50 text-xs tabular-nums pt-0.5">
                  {i + 1}/{lines.length}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-8 text-text-muted text-sm">
            {isBuilding ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span>Waiting for build output…</span>
              </div>
            ) : (
              "No build log available."
            )}
          </div>
        )}
      </div>

      {/* Footer with step count */}
      {lines.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-glass-border text-xs text-text-muted">
          <span>
            {isDone
              ? `${lines.length} step${lines.length !== 1 ? "s" : ""} completed`
              : `Step ${lines.length} of ${lines.length}…`}
          </span>
          {isFailed && (
            <span className="text-danger font-medium">Build failed at step {lines.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
