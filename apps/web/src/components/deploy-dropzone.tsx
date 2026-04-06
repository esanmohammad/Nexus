"use client";

import { useState, useCallback, useRef } from "react";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
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
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors min-h-[44px] ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
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
          <p className="text-sm font-medium text-gray-900">
            {selectedFile.name}
          </p>
          <p className="text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600">
            Drop a ZIP file here or click to browse
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
