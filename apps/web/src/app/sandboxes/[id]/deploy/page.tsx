"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeployDropzone } from "../../../../components/deploy-dropzone";
import { BuildLogStream } from "../../../../components/build-log-stream";

import { API_BASE, getSession } from "../../../../lib/auth";

export default function DeployPage() {
  const params = useParams();
  const id = params.id as string;
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState("idle");

  const { data: sandbox } = useQuery({
    queryKey: ["sandbox", id],
    queryFn: async () => {
      const token = getSession();
      const res = await fetch(`${API_BASE}/api/sandboxes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  async function handleDeploy() {
    if (!file) return;
    setDeploying(true);
    setError(null);
    setBuildStatus("building");

    try {
      const token = getSession();
      const formData = new FormData();
      formData.append("source", file);
      if (label) formData.append("config", JSON.stringify({ label }));

      const res = await fetch(`${API_BASE}/api/sandboxes/${id}/versions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Deploy failed");
      }

      const version = await res.json();
      setBuildStatus("live");
      setResult(version);
    } catch (err: any) {
      setBuildStatus("failed");
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/sandboxes/${id}`}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        &larr; Back to {sandbox?.name || "sandbox"}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Deploy new version
      </h1>

      {sandbox && (
        <p className="text-sm text-gray-500 mb-6">
          Current live version: v{sandbox.current_version}
        </p>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source code
          </label>
          <DeployDropzone onFileSelect={setFile} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Fixed login bug"
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]"
          />
        </div>

        <button
          onClick={handleDeploy}
          disabled={!file || deploying}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {deploying ? "Deploying..." : "Deploy"}
        </button>

        {buildStatus !== "idle" && result && (
          <BuildLogStream
            sandboxId={id}
            versionNumber={result.number || result.current_version || 1}
            status={buildStatus}
          />
        )}

        {result && buildStatus === "live" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              v{result.number || result.current_version} is live!
            </p>
            {sandbox?.cloud_run_url && (
              <a
                href={sandbox.cloud_run_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {sandbox.cloud_run_url}
              </a>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <p className="text-sm text-red-600 mt-1">
              Check the build log for details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
