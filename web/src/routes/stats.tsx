import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { StatsSection, StatsSeriesRange } from "@find-my-house/api-types";
import { StatsPanel } from "@/components/stats/stats-panels";
import { StatsRangePicker } from "@/components/stats/stats-charts";
import { StatsChartSkeleton } from "@/components/stats/stats-chart-skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import * as m from "@/paraglide/messages.js";

const sections: StatsSection[] = [
  "overview",
  "sources",
  "prices",
  "mine",
  "activity",
];

const chartSections: StatsSection[] = [
  "overview",
  "prices",
  "mine",
  "activity",
];

const sectionLabels: Record<StatsSection, () => string> = {
  overview: () => m.stats_section_overview(),
  sources: () => m.stats_section_sources(),
  prices: () => m.stats_section_prices(),
  mine: () => m.stats_section_mine(),
  activity: () => m.stats_section_activity(),
};

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

function StatsPage() {
  const [section, setSection] = useState<StatsSection>("overview");
  const [range, setRange] = useState<StatsSeriesRange>("30d");
  const needsSeries = chartSections.includes(section);

  const query = useQuery({
    queryKey: queryKeys.stats(section),
    queryFn: () => api.stats(section),
  });

  const seriesQuery = useQuery({
    queryKey: queryKeys.statsSeries(range),
    queryFn: () => api.statsSeries(range),
    enabled: needsSeries,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.stats_title()}</h1>
          <p className="text-sm text-muted-foreground">{m.stats_subtitle()}</p>
        </div>
        {needsSeries ? (
          <StatsRangePicker range={range} onChange={setRange} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {sections.map((item) => (
          <Button
            key={item}
            type="button"
            variant={section === item ? "default" : "outline"}
            size="sm"
            onClick={() => setSection(item)}
          >
            {sectionLabels[item]()}
          </Button>
        ))}
      </div>
      {query.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          {needsSeries ? <StatsChartSkeleton /> : null}
        </div>
      ) : null}
      {query.error ? (
        <Alert variant="destructive">{getErrorMessage(query.error)}</Alert>
      ) : null}
      {needsSeries && seriesQuery.error ? (
        <Alert variant="destructive">
          {getErrorMessage(seriesQuery.error)}
        </Alert>
      ) : null}
      {query.data ? (
        <StatsPanel
          section={section}
          data={query.data}
          series={seriesQuery.data}
          seriesLoading={needsSeries && seriesQuery.isLoading}
        />
      ) : null}
    </div>
  );
}
