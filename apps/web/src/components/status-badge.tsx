const colorMap: Record<string, string> = {
  running: "bg-success/15 text-success border-success/20",
  live: "bg-success/15 text-success border-success/20",
  sleeping: "bg-warning/15 text-warning border-warning/20",
  building: "bg-warning/15 text-warning border-warning/20",
  creating: "bg-text-muted/15 text-text-secondary border-text-muted/20",
  rolled_back: "bg-text-muted/15 text-text-secondary border-text-muted/20",
  failed: "bg-danger/15 text-danger border-danger/20",
  destroyed: "bg-danger/15 text-danger border-danger/20",
  destroying: "bg-danger/15 text-danger border-danger/20",
  destroy_failed: "bg-warning/15 text-warning border-warning/20",
};

const dotColorMap: Record<string, string> = {
  running: "bg-success",
  live: "bg-success",
  sleeping: "bg-warning",
  building: "bg-warning animate-pulse",
  creating: "bg-text-muted animate-pulse",
  failed: "bg-danger",
  destroyed: "bg-danger",
  destroy_failed: "bg-warning",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = colorMap[status] || "bg-text-muted/15 text-text-secondary border-text-muted/20";
  const dotClass = dotColorMap[status] || "bg-text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
}
