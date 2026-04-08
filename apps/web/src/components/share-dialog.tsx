"use client";

import { useState } from "react";

interface Props {
  sandboxId: string;
  sandboxUrl: string;
  currentMode: string;
  onClose: () => void;
}

export function ShareDialog({ sandboxId, sandboxUrl, currentMode, onClose }: Props) {
  const [mode, setMode] = useState(currentMode);
  const [emails, setEmails] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const modes = [
    { value: "owner_only", label: "Just me" },
    { value: "team", label: "My team" },
    { value: "anyone", label: "Anyone" },
    { value: "custom", label: "Custom" },
  ];

  async function handleUpdate() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { access_mode: mode };
      if (mode === "custom" && emails) {
        body.allowed_emails = emails.split(",").map((e) => e.trim());
      }
      await fetch(`${API_BASE}/api/sandboxes/${sandboxId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-raised border border-glass-border rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Share Sandbox</h2>

        <div className="space-y-2 mb-4">
          {modes.map((m) => (
            <label key={m.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="access_mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="min-h-[44px] accent-accent"
              />
              <span className="text-sm text-text-primary">{m.label}</span>
            </label>
          ))}
        </div>

        {mode === "custom" && (
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="email1@co.com, email2@co.com"
            className="w-full border border-glass-border bg-glass rounded-xl p-2 text-sm text-text-primary placeholder:text-text-muted mb-4 transition-colors focus:border-accent focus:outline-none"
            rows={3}
          />
        )}

        <div className="flex items-center gap-2 mb-4 p-2 bg-glass rounded-xl text-sm">
          <span className="truncate flex-1 text-text-secondary">{sandboxUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(sandboxUrl)}
            className="text-xs px-2 py-1 border border-glass-border rounded-xl text-text-primary hover:bg-glass-hover min-h-[44px] transition-colors"
          >
            Copy
          </button>
        </div>

        {success && (
          <p className="text-sm text-success mb-4">Access updated!</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-primary border border-glass-border rounded-xl hover:bg-glass-hover min-h-[44px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 min-h-[44px] transition-colors"
          >
            {saving ? "Updating..." : "Update access"}
          </button>
        </div>
      </div>
    </div>
  );
}
