import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";

function sparkSummary(
  data: Record<string, string | number | null>[],
  dataKey: string,
  label: string
): string {
  if (data.length < 2) {
    return `${label}: ${String(data[0]?.[dataKey] ?? "—")}`;
  }
  const values = data
    .map((row) => row[dataKey])
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return `${label}: —`;
  const first = values[0];
  const last = values.at(-1)!;
  return `${label}: ${String(last)} (${first} → ${last})`;
}

export function MiniSparkline({
  data,
  dataKey,
  color = "var(--primary)",
  label,
  className,
}: {
  data: Record<string, string | number | null>[];
  dataKey: string;
  color?: string;
  label: string;
  className?: string;
}) {
  const summary = sparkSummary(data, dataKey, label);

  if (data.length < 2) {
    return <span className="sr-only">{summary}</span>;
  }

  return (
    <div
      className={cn("h-10 w-24 shrink-0", className)}
      role="img"
      aria-label={summary}
    >
      <span className="sr-only">{summary}</span>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, left: 0, bottom: 4 }}
        >
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
