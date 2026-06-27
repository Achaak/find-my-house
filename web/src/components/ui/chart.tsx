import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

export function ChartContainer({
  id,
  className,
  children,
  config,
}: {
  id?: string;
  className?: string;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
  config: ChartConfig;
}) {
  const chartId = React.useId();
  const resolvedId = id ?? chartId;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={resolvedId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        style={
          Object.fromEntries(
            Object.entries(config).map(([key, item]) => [
              `--color-${key}`,
              item.color ?? "var(--primary)",
            ])
          ) as React.CSSProperties
        }
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltip({
  content,
  ...props
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return (
    <RechartsPrimitive.Tooltip
      cursor={false}
      content={content ?? <ChartTooltipContent />}
      {...props}
    />
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
