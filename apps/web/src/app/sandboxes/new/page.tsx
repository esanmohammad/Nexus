"use client";

import { useState } from "react";
import { DeployDropzone } from "../../../components/deploy-dropzone";
import { TtlSlider } from "../../../components/ttl-slider";
import { BuildLogStream } from "../../../components/build-log-stream";
import { StepProgress } from "../../../components/step-progress";

import { API_BASE, getSession } from "../../../lib/auth";

const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;

const STEPS = [
  { label: "Configure" },
  { label: "Building" },
  { label: "Live" },
];

type SourceMode = "zip" | "github";

export default function CreateSandboxPage() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("zip");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubError, setGithubError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [database, setDatabase] = useState(false);
  const [ttl, setTtl] = useState(7);
  const [accessMode, setAccessMode] = useState("owner_only");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string>("idle");
  const [currentStep, setCurrentStep] = useState(0);

  function validateName(val: string) {
    if (val.length < 3 || val.length > 63) {
      setNameError("Name must be 3-63 characters");
    } else if (!NAME_REGEX.test(val)) {
      setNameError("Lowercase letters, numbers, and hyphens only");
    } else {
      setNameError(null);
    }
  }

  function validateGithubUrl(val: string) {
    setGithubUrl(val);
    if (val && !GITHUB_REPO_REGEX.test(val.trim())) {
      setGithubError("Enter a valid GitHub repository URL");
    } else {
      setGithubError(null);
    }
  }

  function handleFileSelect(f: File) {
    setFile(f);
    if (f.name.endsWith(".zip")) {
      setRuntime("auto-detected");
    }
  }

  async function handleShip() {
    if (!name || (sourceMode === "zip" && !file) || (sourceMode === "github" && !githubUrl)) return;
    setCreating(true);
    setError(null);
    setCurrentStep(1); // Building (includes uploading)
    setBuildStatus("uploading");

    try {
      const token = getSession();
      const formData = new FormData();

      if (sourceMode === "zip" && file) {
        formData.append("source", file);
      }

      const config: Record<string, any> = {
        name,
        database,
        ttl_days: ttl,
        access_mode: accessMode,
      };

      if (sourceMode === "github") {
        config.github_url = githubUrl.trim();
      }

      formData.append("config", JSON.stringify(config));

      setBuildStatus("building");

      const res = await fetch(`${API_BASE}/api/sandboxes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Creation failed");
      }

      const sandbox = await res.json();
      setCurrentStep(2); // Live
      setBuildStatus("live");
      setResult(sandbox);
    } catch (err: any) {
      setBuildStatus("failed");
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const canShip =
    name &&
    !nameError &&
    !creating &&
    (sourceMode === "zip" ? !!file : !!githubUrl && !githubError);

  const stepStatus = buildStatus === "failed" ? "failed" : "active";
  const showSteps = buildStatus !== "idle";

  const ACCESS_LABELS: Record<string, string> = {
    owner_only: "Only you can access",
    team: "Anyone in your org",
    anyone: "Public — anyone with the link",
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">
        Create a sandbox
      </h1>

      {showSteps && (
        <StepProgress steps={STEPS} currentStep={currentStep} status={stepStatus} />
      )}

      {/* Step 0: Configure form (hidden once building starts) */}
      {currentStep === 0 && !showSteps && (
        <div className="space-y-4">
          {/* Name section */}
          <div className="glass rounded-2xl p-5 border border-glass-border">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              onBlur={() => { if (name) validateName(name); }}
              placeholder="my-cool-app"
              className="w-full glass rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted border border-glass-border bg-transparent min-h-[44px]"
            />
            {nameError && (
              <p className="text-sm text-danger mt-1">{nameError}</p>
            )}
          </div>

          {/* Source code section */}
          <div className="glass rounded-2xl p-5 border border-glass-border">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Source code
            </label>

            {/* Segmented control */}
            <div className="relative flex bg-glass rounded-xl p-1 border border-glass-border mb-3">
              {/* Sliding indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-accent/20 border border-accent/30 transition-transform duration-200"
                style={{
                  width: '50%',
                  transform: `translateX(${sourceMode === 'github' ? '100%' : '0%'})`,
                }}
              />
              <button
                onClick={() => setSourceMode("zip")}
                className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  sourceMode === "zip" ? "text-accent" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                Upload ZIP
              </button>
              <button
                onClick={() => setSourceMode("github")}
                className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  sourceMode === "github" ? "text-accent" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                GitHub repo
              </button>
            </div>

            {sourceMode === "zip" ? (
              <>
                <DeployDropzone onFileSelect={handleFileSelect} />
                {runtime && (
                  <p className="text-sm text-text-muted mt-1">
                    Runtime: {runtime} (auto-detected)
                  </p>
                )}
              </>
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

          {/* Advanced options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary font-medium transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Advanced options
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: showAdvanced ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="mt-3 space-y-5 p-5 glass rounded-xl border border-glass-border">
                  {/* Database */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={database}
                        onChange={(e) => setDatabase(e.target.checked)}
                        className="w-4 h-4 rounded accent-accent"
                      />
                      <span className="text-sm font-medium text-text-primary">
                        Enable database
                      </span>
                    </label>
                    <p className="text-xs text-text-muted mt-1 ml-7">
                      Provisions a Neon Postgres branch for this sandbox
                    </p>
                  </div>

                  {/* TTL */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      TTL
                    </label>
                    <TtlSlider value={ttl} onChange={setTtl} />
                    <p className="text-xs text-text-muted mt-1">
                      Sandbox auto-destroys after this many days
                    </p>
                  </div>

                  {/* Access mode */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Access mode
                    </label>
                    <div className="space-y-2">
                      {(["owner_only", "team", "anyone"] as const).map((mode) => (
                        <label
                          key={mode}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                            accessMode === mode
                              ? "glass bg-accent/15 border border-accent/40"
                              : "hover:bg-glass border border-transparent"
                          }`}
                        >
                          <input
                            type="radio"
                            name="access_mode"
                            value={mode}
                            checked={accessMode === mode}
                            onChange={() => setAccessMode(mode)}
                            className="accent-accent"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-text-primary">
                              {mode.replace("_", " ")}
                            </span>
                            <p className="text-xs text-text-muted">
                              {ACCESS_LABELS[mode]}
                            </p>
                          </div>
                          {accessMode === mode && (
                            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ship button section */}
          <div className="glass rounded-2xl p-5 border border-glass-border">
            <button
              onClick={handleShip}
              disabled={!canShip}
              className={`w-full py-3 font-semibold rounded-xl min-h-[44px] transition-all ${
                canShip
                  ? "bg-gradient-to-r from-accent to-indigo-400 text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] glow-accent cursor-pointer"
                  : "bg-text-muted/20 text-text-muted cursor-not-allowed"
              }`}
            >
              {creating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Shipping...
                </>
              ) : "Ship it"}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Building state (includes uploading) */}
      {showSteps && currentStep === 1 && buildStatus !== "live" && buildStatus !== "failed" && (
        <div className="space-y-4">
          {(buildStatus === "uploading") && (
            <div className="glass rounded-xl p-6 text-center">
              <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-text-secondary">Uploading source code…</p>
            </div>
          )}
          {buildStatus === "building" && (
            <>
              <BuildLogStream
                sandboxId={result?.id || "pending"}
                versionNumber={1}
                status="building"
              />
            </>
          )}
        </div>
      )}

      {/* Step 3: Live */}
      {result && buildStatus === "live" && (
        <div className="p-5 glass rounded-xl border border-success/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-success font-semibold">Your sandbox is live!</p>
          </div>
          {result.cloud_run_url && (
            <a
              href={result.cloud_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan hover:underline font-mono"
            >
              {result.cloud_run_url}
            </a>
          )}
          <div className="mt-4 flex gap-2">
            <a
              href={`/sandboxes/${result.id}`}
              className="px-4 py-2 text-sm bg-accent/20 text-accent rounded-xl hover:bg-accent/30 font-medium transition-colors"
            >
              View sandbox
            </a>
            <a
              href="/"
              className="px-4 py-2 text-sm glass rounded-xl text-text-secondary hover:text-text-primary transition-colors"
            >
              Back to dashboard
            </a>
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
              setCreating(false);
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
