"use client";

interface Props {
  value?: number;
  onChange: (days: number) => void;
}

export function TtlSlider({ value = 7, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={1}
        max={90}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-h-[44px]"
        aria-label="TTL in days"
        aria-valuemin={1}
        aria-valuemax={90}
        aria-valuenow={value}
      />
      <span className="text-sm font-medium text-gray-700 w-16 text-right">
        {value} {value === 1 ? "day" : "days"}
      </span>
    </div>
  );
}
