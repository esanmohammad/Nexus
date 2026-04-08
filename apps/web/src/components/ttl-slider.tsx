"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

interface Props {
  value?: number;
  onChange: (days: number) => void;
}

const PRESETS = [1, 7, 14, 30, 60, 90] as const;
const LABELS = ["1d", "7d", "14d", "30d", "60d", "90d", "Custom"] as const;

export function TtlSlider({ value = 7, onChange }: Props) {
  const presetIndex = PRESETS.indexOf(value as (typeof PRESETS)[number]);
  const isCustom = presetIndex === -1;
  const selectedIndex = isCustom ? LABELS.length - 1 : presetIndex;

  const [customValue, setCustomValue] = useState<string>(
    isCustom ? String(value) : ""
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const updateIndicator = useCallback(() => {
    const btn = buttonRefs.current[selectedIndex];
    const indicator = indicatorRef.current;
    const container = containerRef.current;
    if (!btn || !indicator || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    indicator.style.transform = `translateX(${btnRect.left - containerRect.left}px)`;
    indicator.style.width = `${btnRect.width}px`;
  }, [selectedIndex]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    // Update on resize
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  // Sync custom value when value prop changes externally
  useEffect(() => {
    if (isCustom) {
      setCustomValue(String(value));
    }
  }, [value, isCustom]);

  function handleSelect(index: number) {
    if (index < PRESETS.length) {
      onChange(PRESETS[index]);
    } else {
      // Custom — use current custom value or default to current value
      const num = Number(customValue) || value;
      const clamped = Math.max(1, Math.min(365, num));
      setCustomValue(String(clamped));
      onChange(clamped);
    }
  }

  function handleCustomChange(val: string) {
    setCustomValue(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 1 && num <= 365) {
      onChange(num);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const total = LABELS.length;
    let newIndex = selectedIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      newIndex = (selectedIndex + 1) % total;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      newIndex = (selectedIndex - 1 + total) % total;
    } else {
      return;
    }

    handleSelect(newIndex);
    buttonRefs.current[newIndex]?.focus();
  }

  return (
    <div className="space-y-3">
      {/* Value display */}
      <p className="text-2xl font-bold text-text-primary">
        {value} <span className="text-base font-normal text-text-secondary">{value === 1 ? "day" : "days"}</span>
      </p>

      {/* Segmented picker */}
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="TTL preset"
        onKeyDown={handleKeyDown}
        className="relative glass rounded-xl p-1 flex"
      >
        {/* Sliding indicator */}
        <div
          ref={indicatorRef}
          className="absolute top-1 bottom-1 rounded-lg bg-accent/20 transition-transform duration-200 ease-out"
          style={{ width: 0 }}
          aria-hidden="true"
        />

        {LABELS.map((label, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              key={label}
              ref={(el) => { buttonRefs.current[i] = el; }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(i)}
              className={`relative z-10 flex-1 px-2 py-2 text-sm font-medium rounded-lg transition-colors duration-150 min-h-[36px] ${
                isSelected ? "text-accent" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      {isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-24 glass rounded-lg px-3 py-2 text-sm text-text-primary border border-glass-border bg-transparent min-h-[36px] text-center"
            aria-label="Custom TTL in days"
          />
          <span className="text-sm text-text-secondary">days (1–365)</span>
        </div>
      )}
    </div>
  );
}
