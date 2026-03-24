type KpiCardProps = {
  title: string;
  value: string | number;
  tone?: "default" | "ok" | "warn";
};

const toneClassMap: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "from-indigo-500/15 to-sky-500/10",
  ok: "from-emerald-500/20 to-teal-500/10",
  warn: "from-rose-500/20 to-red-500/10"
};

export function KpiCard({ title, value, tone = "default" }: KpiCardProps) {
  return (
    <div className={`surface-card rounded-2xl bg-gradient-to-br p-4 ${toneClassMap[tone]}`}>
      <p className="text-xs uppercase tracking-wide muted-text">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
