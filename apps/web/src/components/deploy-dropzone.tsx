"use client";

import { useState, useCallback, useRef } from "react";

const MAX_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
];

interface Props {
  onFileSelect: (file: File) => void;
}

export function DeployDropzone({ onFileSelect }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      const isZip =
        ACCEPTED_TYPES.includes(file.type) ||
        file.name.endsWith(".zip") ||
        file.name.endsWith(".tar.gz") ||
        file.name.endsWith(".tgz");

      if (!isZip) {
        setError("Only ZIP or tarball files are accepted");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("File must be under 100 MB");
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 min-h-[44px] ${
        isDragging
          ? "border-2 border-accent bg-accent/5 glow-accent"
          : "glass border border-dashed border-glass-border hover:border-accent/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.tar.gz,.tgz"
        onChange={handleFileInput}
        className="hidden"
      />

      {selectedFile ? (
        <div>
          <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">{selectedFile.name}</p>
          <p className="text-xs text-text-muted mt-1">{formatSize(selectedFile.size)}</p>
        </div>
      ) : (
        <div>
          <div className="w-10 h-10 mx-auto mb-3 rounded-xl glass flex items-center justify-center">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm text-text-secondary">
            Drop a <span className="text-text-primary font-medium">.zip</span> here or click to browse
          </p>
          <p className="text-xs text-text-muted mt-1">Up to 100 MB</p>
        </div>
      )}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
