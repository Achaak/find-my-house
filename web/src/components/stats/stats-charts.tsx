import type { ReactNode } from "react";
import type {
  SourcePublicationCounts,
  StatsOverview,
  StatsSeriesData,
  StatsSeriesRange,
} from "@find-my-house/api-types";
import { LISTING_SOURCES } from "@find-my-house/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPrice, formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

const stockConfig = (): ChartConfig => ({
  stock: { label: m.stats_series_stock(), color: "var(--primary)" },
});

const medianConfig = (): ChartConfig => ({
  median: { label: m.stats_label_median(), color: "var(--price-drop)" },
});

const activityConfig = (): ChartConfig => ({
  added: { label: m.stats_chart_added(), color: "var(--like)" },
  deactivated: { label: m.stats_chart_deactivated(), color: "var(--dislike)" },
});

const reactionConfig = (): ChartConfig => ({
  likes: { label: m.stats_label_likes(), color: "var(--like)" },
  dislikes: { label: m.stats_label_dislikes(), color: "var(--dislike)" },
});

const histogramConfig = (): ChartConfig => ({
  count: { label: m.stats_label_properties(), color: "var(--primary)" },
});

export function StatsRangePicker({
  range,
  onChange,
}: {
  range: StatsSeriesRange;
  onChange: (range: StatsSeriesRange) => void;
}) {
  const options: StatsSeriesRange[] = ["7d", "30d", "90d"];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`rounded-md border px-3 py-1 text-sm ${
            range === option
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background"
          }`}
          onClick={() => onChange(option)}
        >
          {m.stats_range({ range: option })}
        </button>
      ))}
    </div>
  );
}

export function OverviewCharts({
  overview,
  series,
}: {
  overview: StatsOverview;
  series: StatsSeriesData;
}) {
  const sourceData = LISTING_SOURCES.flatMap((source) => {
    const counts = overview.sourceCounts[source];
    if (counts.active + counts.inactive === 0) return [];
    return [
      {
        source: formatSource(source),
        active: counts.active,
        inactive: counts.inactive,
      },
    ];
  });

  const cityData = overview.topCities.map((entry) => ({
    city: entry.city,
    count: entry.count,
  }));

  const reactionData = [
    { name: m.stats_label_likes(), value: overview.likes, fill: "var(--like)" },
    {
      name: m.stats_label_dislikes(),
      value: overview.dislikes,
      fill: "var(--dislike)",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={m.stats_chart_stock()}>
        <ChartContainer config={stockConfig()} className="min-h-[220px]">
          <LineChart data={series.snapshots}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickMargin={8} minTickGap={24} />
            <YAxis width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="activeProperties"
              name={m.stats_label_active()}
              stroke="var(--color-stock)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title={m.stats_chart_sources()}>
        <ChartContainer config={histogramConfig()} className="min-h-[220px]">
          <BarChart data={sourceData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="source" tickMargin={8} />
            <YAxis width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar
              dataKey="active"
              name={m.stats_chart_active()}
              stackId="a"
              fill="var(--like)"
            />
            <Bar
              dataKey="inactive"
              name={m.stats_chart_inactive()}
              stackId="a"
              fill="var(--dislike)"
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title={m.stats_chart_cities()}>
        <ChartContainer config={histogramConfig()} className="min-h-[220px]">
          <BarChart data={cityData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="city" type="category" width={80} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              name={m.stats_label_properties()}
              fill="var(--primary)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title={m.stats_chart_reactions()}>
        <ChartContainer config={reactionConfig()} className="min-h-[220px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={reactionData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
            >
              {reactionData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

export function SourcesChart({
  sourceCounts,
}: {
  sourceCounts: SourcePublicationCounts;
}) {
  const data = LISTING_SOURCES.flatMap((source) => {
    const counts = sourceCounts[source];
    if (counts.active + counts.inactive === 0) return [];
    return [
      {
        source: formatSource(source),
        active: counts.active,
        inactive: counts.inactive,
      },
    ];
  });

  return (
    <ChartCard title={m.stats_chart_sources()}>
      <ChartContainer config={histogramConfig()} className="min-h-[240px]">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="source" />
          <YAxis width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          <Bar
            dataKey="active"
            name={m.stats_chart_active()}
            stackId="a"
            fill="var(--like)"
          />
          <Bar
            dataKey="inactive"
            name={m.stats_chart_inactive()}
            stackId="a"
            fill="var(--dislike)"
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function PricesCharts({ series }: { series: StatsSeriesData }) {
  const medianData = series.snapshots.map((row) => ({
    date: row.date,
    median: row.medianPrice,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={m.stats_chart_price_histogram()}>
        <ChartContainer config={histogramConfig()} className="min-h-[240px]">
          <BarChart data={series.priceHistogram}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickMargin={8}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              name={m.stats_label_properties()}
              fill="var(--primary)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title={m.stats_chart_median()}>
        <ChartContainer config={medianConfig()} className="min-h-[240px]">
          <LineChart data={medianData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis width={56} tickFormatter={(v) => formatPrice(Number(v))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="median"
              name={m.stats_label_median()}
              stroke="var(--color-median)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

export function MineCharts({ series }: { series: StatsSeriesData }) {
  const weekly = series.reactions.map((row) => ({
    week: row.week,
    likes: row.likes,
    dislikes: row.dislikes,
  }));

  return (
    <ChartCard title={m.stats_chart_reactions_weekly()}>
      <ChartContainer config={reactionConfig()} className="min-h-[240px]">
        <BarChart data={weekly}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" />
          <YAxis width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          <Bar
            dataKey="likes"
            name={m.stats_label_likes()}
            fill="var(--like)"
            radius={4}
          />
          <Bar
            dataKey="dislikes"
            name={m.stats_label_dislikes()}
            fill="var(--dislike)"
            radius={4}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function ActivityCharts({ series }: { series: StatsSeriesData }) {
  const byDate = new Map<
    string,
    { date: string; added: number; deactivated: number; scrapes: number }
  >();

  for (const row of series.newProperties) {
    const current = byDate.get(row.date) ?? {
      date: row.date,
      added: 0,
      deactivated: 0,
      scrapes: 0,
    };
    current.added = row.value;
    byDate.set(row.date, current);
  }
  for (const row of series.deactivations) {
    const current = byDate.get(row.date) ?? {
      date: row.date,
      added: 0,
      deactivated: 0,
      scrapes: 0,
    };
    current.deactivated = row.value;
    byDate.set(row.date, current);
  }
  for (const row of series.scrapes) {
    const current = byDate.get(row.date) ?? {
      date: row.date,
      added: 0,
      deactivated: 0,
      scrapes: 0,
    };
    current.scrapes = row.value;
    byDate.set(row.date, current);
  }

  const data = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={m.stats_chart_activity_flow()}>
        <ChartContainer config={activityConfig()} className="min-h-[240px]">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar
              dataKey="added"
              name={m.stats_chart_added()}
              fill="var(--like)"
              radius={4}
            />
            <Bar
              dataKey="deactivated"
              name={m.stats_chart_deactivated()}
              fill="var(--dislike)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title={m.stats_chart_scrapes()}>
        <ChartContainer config={stockConfig()} className="min-h-[240px]">
          <LineChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={24} />
            <YAxis width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="scrapes"
              name={m.stats_chart_scrapes()}
              stroke="var(--color-stock)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card role="group" aria-label={title}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
