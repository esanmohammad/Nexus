"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeployDropzone } from "../../../../components/deploy-dropzone";
import { BuildLogStream } from "../../../../components/build-log-stream";
import { StepProgress } from "../../../../components/step-progress";

import { API_BASE, getSession } from "../../../../lib/auth";

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;

const STEPS = [
  { label: "Configure" },
  { label: "Building" },
  { label: "Live" },
];

type SourceMode = "zip" | "github";

export default function DeployPage() {
  const params = useParams();
  const id = params.id as string;
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("zip");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubError, setGithubError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

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

  function validateGithubUrl(val: string) {
    setGithubUrl(val);
    if (val && !GITHUB_REPO_REGEX.test(val.trim())) {
      setGithubError("Enter a valid GitHub repository URL");
    } else {
      setGithubError(null);
    }
  }

  function handleDeploy() {
    if (sourceMode === "zip" && !file) return;
    if (sourceMode === "github" && (!githubUrl || githubError)) return;
    setShowConfirm(true);
  }

  async function proceedDeploy() {
    setShowConfirm(false);
    setDeploying(true);
    setError(null);
    setCurrentStep(1); // Building (includes uploading)
    setBuildStatus("uploading");

    try {
      const token = getSession();
      const formData = new FormData();

      if (sourceMode === "zip" && file) {
        formData.append("source", file);
      }

      const config: Record<string, any> = {};
      if (label) config.label = label;
      if (sourceMode === "github") config.github_url = githubUrl.trim();
      if (Object.keys(config).length > 0) {
        formData.append("config", JSON.stringify(config));
      }

      setBuildStatus("building");

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
      setCurrentStep(2);
      setBuildStatus("live");
      setResult(version);
    } catch (err: any) {
      setBuildStatus("failed");
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  }

  const canDeploy =
    !deploying &&
    (sourceMode === "zip" ? !!file : !!githubUrl && !githubError);

  const stepStatus = buildStatus === "failed" ? "failed" : "active";
  const showSteps = buildStatus !== "idle";

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/sandboxes/${id}`}
        className="text-sm text-accent hover:underline mb-4 inline-block"
      >
        &larr; Back to {sandbox?.name || "sandbox"}
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-2">
        Deploy new version
      </h1>

      {sandbox && (
        <p className="text-sm text-text-muted mb-6">
          Current live version: v{sandbox.current_version}
        </p>
      )}

      {showSteps && (
        <StepProgress steps={STEPS} currentStep={currentStep} status={stepStatus} />
      )}

      {/* Configure form - hidden when showing confirm */}
      {currentStep === 0 && !showSteps && !showConfirm && (
        <div className="space-y-6">
          {/* Source mode toggle */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Source code
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSourceMode("zip")}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                  sourceMode === "zip"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "glass text-text-muted hover:text-text-secondary"
                }`}
              >
                Upload ZIP
              </button>
              <button
                onClick={() => setSourceMode("github")}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                  sourceMode === "github"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "glass text-text-muted hover:text-text-secondary"
                }`}
              >
                GitHub repo
              </button>
            </div>

            {sourceMode === "zip" ? (
              <DeployDropzone onFileSelect={setFile} />
            ) : (
              <div>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => validateGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted border border-glass-border bg-transparent min-h-[44px]"
                />
                {githubError && (
                  <p className="text-sm text-danger mt-1">{githubError}</p>
                )}
                <p className="text-xs text-text-muted mt-2">
                  Nexus will clone and build the repository&#39;s default branch
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Version label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Fixed login bug"
              className="w-full glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted border border-glass-border bg-transparent min-h-[44px]"
            />
          </div>

          <button
            onClick={handleDeploy}
            disabled={!canDeploy}
            className={`w-full py-3 font-semibold rounded-xl min-h-[44px] transition-all ${
              canDeploy
                ? "bg-gradient-to-r from-accent to-indigo-400 text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] glow-accent cursor-pointer"
                : "bg-text-muted/20 text-text-muted cursor-not-allowed"
            }`}
          >
            {deploying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deploying...
              </>
            ) : "Deploy"}
          </button>
        </div>
      )}

      {/* Deploy confirmation */}
      {showConfirm && !showSteps && (
        <div className="glass rounded-2xl p-5 border border-warning/20 bg-warning/[0.03]">
          <p className="text-sm text-text-primary mb-1 font-medium">
            Replace v{sandbox?.current_version}?
          </p>
          <p className="text-xs text-text-muted mb-4">
            The current version will still be available for rollback.
          </p>
          <div className="flex gap-2">
            <button
              onClick={proceedDeploy}
              className="px-4 py-2 text-sm bg-gradient-to-r from-accent to-indigo-400 text-white font-semibold rounded-xl hover:brightness-110 transition-all"
            >
              Confirm deploy
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Building state (includes uploading) */}
      {showSteps && currentStep === 1 && buildStatus !== "live" && buildStatus !== "failed" && (
        <div className="space-y-4">
          {buildStatus === "uploading" && (
            <div className="glass rounded-xl p-6 text-center">
              <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-text-secondary">Uploading source code…</p>
            </div>
          )}
          {buildStatus === "building" && (
            <BuildLogStream
              sandboxId={id}
              versionNumber={result?.number || result?.current_version || (sandbox?.current_version || 0) + 1}
              status="building"
            />
          )}
        </div>
      )}

      {/* Live */}
      {result && buildStatus === "live" && (
        <div className="p-5 glass rounded-xl border border-success/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-success font-semibold">
              v{result.number || result.current_version} is live!
            </p>
          </div>
          {sandbox?.cloud_run_url && (
            <a
              href={sandbox.cloud_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan hover:underline font-mono"
            >
              {sandbox.cloud_run_url}
            </a>
          )}
          <div className="mt-4 flex gap-2">
            <Link
              href={`/sandboxes/${id}`}
              className="px-4 py-2 text-sm bg-accent/20 text-accent rounded-xl hover:bg-accent/30 font-medium transition-colors"
            >
              View sandbox
            </Link>
          </div>
        </div>
      )}

      {/* Failed */}
      {error && (
        <div className="p-5 glass rounded-xl border border-danger/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-danger/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-danger font-semibold">Deployment failed</p>
          </div>
          <p className="text-sm text-text-secondary mb-3">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setBuildStatus("idle");
              setCurrentStep(0);
              setDeploying(false);
              setResult(null);
            }}
            className="px-4 py-2 text-sm bg-danger/20 text-danger rounded-xl hover:bg-danger/30 font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
