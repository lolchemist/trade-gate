export function ReadinessCard({
  title,
  value,
  inverse = false,
}: {
  title: string;
  value: number;
  inverse?: boolean;
}) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${inverse ? "bg-red-300" : "bg-emerald-300"}`} style={{ width: `${normalized}%` }} />
        </div>
        <div className="font-mono text-sm text-neutral-200">{normalized}%</div>
      </div>
    </div>
  );
}
