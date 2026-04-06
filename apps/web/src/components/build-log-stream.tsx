"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  sandboxId: string;
  versionNumber: number;
  status: string;
}

export function BuildLogStream({ sandboxId, versionNumber, status }: Props) {
  const [log, setLog] = useState("");
  const containerRef = useRef<HTMLPreElement>(null);
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

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-400">Build Log</span>
        {isBuilding && (
          <span className="text-xs text-yellow-400 animate-pulse">
            Building...
          </span>
        )}
        {status === "live" && (
          <span className="text-xs text-green-400">&#10003; Complete</span>
        )}
        {status === "failed" && (
          <span className="text-xs text-red-400">&#10007; Failed</span>
        )}
      </div>

      <pre
        ref={containerRef}
        className="font-mono text-xs text-green-300 overflow-auto max-h-64 whitespace-pre-wrap"
      >
        {lines.length > 0
          ? lines.map((line, i) => (
              <div key={i}>
                {isDone && i < lines.length - 1 ? (
                  <span className="text-green-500 mr-1">&#10003;</span>
                ) : isBuilding && i === lines.length - 1 ? (
                  <span className="text-yellow-400 mr-1 animate-spin inline-block">&#9696;</span>
                ) : null}
                Step {i + 1}/{lines.length}: {line}
              </div>
            ))
          : isBuilding
            ? "Waiting for build output..."
            : "No build log available."}
      </pre>
    </div>
  );
}
