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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Share Sandbox</h2>

        <div className="space-y-2 mb-4">
          {modes.map((m) => (
            <label key={m.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="access_mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="min-h-[44px]"
              />
              <span className="text-sm">{m.label}</span>
            </label>
          ))}
        </div>

        {mode === "custom" && (
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="email1@co.com, email2@co.com"
            className="w-full border rounded p-2 text-sm mb-4"
            rows={3}
          />
        )}

        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded text-sm">
          <span className="truncate flex-1">{sandboxUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(sandboxUrl)}
            className="text-xs px-2 py-1 border rounded hover:bg-gray-100 min-h-[44px]"
          >
            Copy
          </button>
        </div>

        {success && (
          <p className="text-sm text-green-600 mb-4">Access updated!</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
          >
            {saving ? "Updating..." : "Update access"}
          </button>
        </div>
      </div>
    </div>
  );
}
