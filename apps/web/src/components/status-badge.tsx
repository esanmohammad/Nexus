const colorMap: Record<string, string> = {
  running: "bg-green-500 text-white",
  live: "bg-green-500 text-white",
  sleeping: "bg-yellow-500 text-white",
  building: "bg-yellow-500 text-white",
  creating: "bg-gray-400 text-white",
  rolled_back: "bg-gray-400 text-white",
  failed: "bg-red-500 text-white",
  destroyed: "bg-red-500 text-white",
  destroying: "bg-red-500 text-white",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = colorMap[status] || "bg-gray-400 text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}
