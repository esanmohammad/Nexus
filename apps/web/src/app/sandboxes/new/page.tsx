"use client";

import { useState } from "react";
import { DeployDropzone } from "../../../components/deploy-dropzone";
import { TtlSlider } from "../../../components/ttl-slider";
import { BuildLogStream } from "../../../components/build-log-stream";

import { API_BASE, getSession } from "../../../lib/auth";

const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;

export default function CreateSandboxPage() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [database, setDatabase] = useState(false);
  const [ttl, setTtl] = useState(7);
  const [accessMode, setAccessMode] = useState("owner_only");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string>("idle");

  function validateName(val: string) {
    setName(val);
    if (val.length < 3 || val.length > 63) {
      setNameError("Name must be 3-63 characters");
    } else if (!NAME_REGEX.test(val)) {
      setNameError("Lowercase letters, numbers, and hyphens only");
    } else {
      setNameError(null);
    }
  }

  function handleFileSelect(f: File) {
    setFile(f);
    if (f.name.endsWith(".zip")) {
      setRuntime("auto-detected");
    }
  }

  async function handleShip() {
    if (!name || !file) return;
    setCreating(true);
    setError(null);
    setBuildStatus("building");

    try {
      const formData = new FormData();
      formData.append("source", file);
      formData.append(
        "config",
        JSON.stringify({
          name,
          database,
          ttl_days: ttl,
          access_mode: accessMode,
        })
      );

      const token = getSession();
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
      setBuildStatus("live");
      setResult(sandbox);
    } catch (err: any) {
      setBuildStatus("failed");
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const canShip = name && !nameError && file && !creating;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create a sandbox
      </h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => validateName(e.target.value)}
            placeholder="my-cool-app"
            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]"
          />
          {nameError && (
            <p className="text-sm text-red-600 mt-1">{nameError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source code
          </label>
          <DeployDropzone onFileSelect={handleFileSelect} />
          {runtime && (
            <p className="text-sm text-gray-500 mt-1">
              Runtime: {runtime} (auto-detected)
            </p>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4 p-4 border rounded-lg">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={database}
                  onChange={(e) => setDatabase(e.target.checked)}
                />
                <span className="text-sm">Enable database</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TTL
                </label>
                <TtlSlider value={ttl} onChange={setTtl} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access mode
                </label>
                <div className="flex gap-4">
                  {["owner_only", "team", "anyone"].map((mode) => (
                    <label key={mode} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="access_mode"
                        value={mode}
                        checked={accessMode === mode}
                        onChange={() => setAccessMode(mode)}
                      />
                      <span className="text-sm">{mode.replace("_", " ")}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleShip}
          disabled={!canShip}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {creating ? "Shipping..." : "Ship it"}
        </button>

        {buildStatus !== "idle" && result && (
          <BuildLogStream
            sandboxId={result.id}
            versionNumber={1}
            status={buildStatus}
          />
        )}

        {result && buildStatus === "live" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">Live!</p>
            <a
              href={result.cloud_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {result.cloud_run_url}
            </a>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
