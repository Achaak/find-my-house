import type { ReactNode } from "react";
import type {
  ActivityStats,
  SourcePublicationCounts,
  StatsActivity,
  StatsMine,
  StatsOverview,
  StatsPrices,
  StatsResponseMap,
  StatsSection,
  StatsSeriesData,
  StatsSources,
} from "@find-my-house/api-types";
import { LISTING_SOURCES } from "@find-my-house/api-types";
import { PropertyGridCard } from "@/components/listings/property-grid-card";
import {
  ActivityCharts,
  MineCharts,
  OverviewCharts,
  PricesCharts,
  SourcesChart,
} from "@/components/stats/stats-charts";
import { StatsChartSkeleton } from "@/components/stats/stats-chart-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocaleDateTime } from "@/lib/locale";
import { formatPrice, formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatSourceLines(counts: SourcePublicationCounts): string {
  return LISTING_SOURCES.map((source) => {
    const { active, inactive } = counts[source];
    const total = active + inactive;
    if (total === 0) return null;
    const inactiveSuffix =
      inactive > 0 ? m.stats_source_inactive({ count: inactive }) : "";
    return String(
      m.stats_source_active_line({
        source: formatSource(source),
        count: active,
        inactive: inactiveSuffix,
      })
    );
  })
    .filter((line): line is string => line !== null)
    .join("\n");
}

function formatScrapedAt(date: string | null): string {
  if (!date) return m.stats_never();
  return formatLocaleDateTime(date);
}

function formatActivityBlock(activity: ActivityStats): string {
  return [
    m.stats_last_scrape({ date: formatScrapedAt(activity.lastScrapedAt) }),
    m.stats_new_7d({ count: activity.addedLast7Days }),
    m.stats_deactivated_7d({ count: activity.deactivatedLast7Days }),
    m.stats_multi_source({ count: activity.multiSourceCount }),
  ].join("\n");
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function formatEnrichmentBlock(enrichment: {
  pending: number;
  queued: number;
}): string {
  const queuedLine =
    enrichment.queued > 0
      ? m.stats_enrichment_queued({ count: enrichment.queued })
      : "";
  return m.stats_enrichment_pending({
    count: enrichment.pending,
    queued: queuedLine,
  });
}

function SeriesCharts({
  series,
  seriesLoading,
  children,
}: {
  series?: StatsSeriesData;
  seriesLoading?: boolean;
  children: (series: StatsSeriesData) => ReactNode;
}) {
  if (seriesLoading) return <StatsChartSkeleton />;
  if (!series) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.stats_charts_unavailable()}
      </p>
    );
  }
  return <>{children(series)}</>;
}

function OverviewPanel({
  data,
  series,
  seriesLoading,
}: {
  data: StatsOverview;
  series?: StatsSeriesData;
  seriesLoading?: boolean;
}) {
  const priceDrops =
    data.priceDrops > 0
      ? m.stats_overview_price_drops({ count: data.priceDrops })
      : "";
  const toEnrich =
    data.enrichment.pending > 0
      ? m.stats_overview_to_enrich({ count: data.enrichment.pending })
      : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {m.stats_overview_summary({
          active: data.activeProperties,
          total: data.total,
          activePubs: data.activePublications,
          inactivePubs: data.inactivePublications,
          priceDrops,
          toEnrich,
        })}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={m.stats_label_properties()}
          value={String(data.total)}
        />
        <StatCard
          label={m.stats_label_active()}
          value={String(data.activeProperties)}
        />
        <StatCard
          label={m.stats_label_publications()}
          value={String(data.activePublications)}
        />
        <StatCard
          label={m.stats_label_price_drops()}
          value={String(data.priceDrops)}
        />
        <StatCard
          label={m.stats_label_to_enrich()}
          value={String(data.enrichment.pending)}
        />
        <StatCard
          label={m.stats_label_enrichment_queue()}
          value={String(data.enrichment.queued)}
        />
        <StatCard label={m.stats_label_likes()} value={String(data.likes)} />
        <StatCard
          label={m.stats_label_dislikes()}
          value={String(data.dislikes)}
        />
      </div>
      <SeriesCharts series={series} seriesLoading={seriesLoading}>
        {(resolved) => <OverviewCharts overview={data} series={resolved} />}
      </SeriesCharts>
      {data.recent.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.recent.map((property) => (
            <PropertyGridCard key={property.id} property={property} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourcesPanel({ data }: { data: StatsSources }) {
  const totalActive = LISTING_SOURCES.reduce(
    (sum, source) => sum + data.sourceCounts[source].active,
    0
  );
  const totalInactive = LISTING_SOURCES.reduce(
    (sum, source) => sum + data.sourceCounts[source].inactive,
    0
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {m.stats_sources_summary({
          active: totalActive,
          inactive: totalInactive,
          multi: data.multiSourceCount,
        })}
      </p>
      <SourcesChart sourceCounts={data.sourceCounts} />
      <InfoBlock title={m.stats_by_portal()}>
        {formatSourceLines(data.sourceCounts) || m.stats_no_publications()}
      </InfoBlock>
    </div>
  );
}

function PricesPanel({
  data,
  series,
  seriesLoading,
}: {
  data: StatsPrices;
  series?: StatsSeriesData;
  seriesLoading?: boolean;
}) {
  const emDash = m.common_em_dash();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={m.stats_label_ongoing_drops()}
          value={String(data.priceDrops)}
        />
        <StatCard
          label={m.stats_label_median()}
          value={data.priceStats ? formatPrice(data.priceStats.median) : emDash}
        />
        <StatCard
          label={m.stats_label_average()}
          value={
            data.priceStats ? formatPrice(data.priceStats.average) : emDash
          }
        />
        <StatCard
          label={m.stats_label_range()}
          value={
            data.priceStats
              ? `${formatPrice(data.priceStats.min)} – ${formatPrice(data.priceStats.max)}`
              : emDash
          }
        />
        <StatCard
          label={m.stats_label_active_properties()}
          value={data.priceStats ? String(data.priceStats.count) : emDash}
        />
      </div>
      <SeriesCharts series={series} seriesLoading={seriesLoading}>
        {(resolved) => <PricesCharts series={resolved} />}
      </SeriesCharts>
      {data.drops.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.drops.map((property) => (
            <PropertyGridCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {m.stats_no_price_drops()}
        </p>
      )}
    </div>
  );
}

function MinePanel({
  data,
  series,
  seriesLoading,
}: {
  data: StatsMine;
  series?: StatsSeriesData;
  seriesLoading?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {m.stats_mine_summary({
          likes: data.likes,
          dislikes: data.dislikes,
        })}
      </p>
      <SeriesCharts series={series} seriesLoading={seriesLoading}>
        {(resolved) => <MineCharts series={resolved} />}
      </SeriesCharts>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-medium">{m.stats_recent_favorites()}</h2>
          {data.recentLikes.length ? (
            data.recentLikes.map((property) => (
              <PropertyGridCard key={property.id} property={property} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {m.stats_no_favorites()}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-sm font-medium">{m.stats_recent_dislikes()}</h2>
          {data.recentDislikes.length ? (
            data.recentDislikes.map((property) => (
              <PropertyGridCard key={property.id} property={property} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {m.stats_no_dislikes()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityPanel({
  data,
  series,
  seriesLoading,
}: {
  data: StatsActivity;
  series?: StatsSeriesData;
  seriesLoading?: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {m.stats_area({ label: data.zoneLabel })}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoBlock title={m.stats_block_scraping()}>
          {[
            m.stats_last_scrape({
              date: formatScrapedAt(data.activity.lastScrapedAt),
            }),
            m.stats_schedule({ cron: data.cron }),
            m.stats_scrapers({
              list: data.scrapers.join(", ") || m.common_em_dash(),
            }),
          ].join("\n")}
        </InfoBlock>
        <InfoBlock title={m.stats_block_last_7d()}>
          {formatActivityBlock(data.activity)}
        </InfoBlock>
        <InfoBlock title={m.stats_block_enrichment()}>
          {formatEnrichmentBlock(data.enrichment)}
        </InfoBlock>
      </div>
      <SeriesCharts series={series} seriesLoading={seriesLoading}>
        {(resolved) => <ActivityCharts series={resolved} />}
      </SeriesCharts>
      {data.recent.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.recent.map((property) => (
            <PropertyGridCard key={property.id} property={property} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StatsPanel({
  section,
  data,
  series,
  seriesLoading = false,
}: {
  section: StatsSection;
  data: StatsResponseMap[StatsSection];
  series?: StatsSeriesData;
  seriesLoading?: boolean;
}) {
  switch (section) {
    case "overview":
      return (
        <OverviewPanel
          data={data as StatsOverview}
          series={series}
          seriesLoading={seriesLoading}
        />
      );
    case "sources":
      return <SourcesPanel data={data as StatsSources} />;
    case "prices":
      return (
        <PricesPanel
          data={data as StatsPrices}
          series={series}
          seriesLoading={seriesLoading}
        />
      );
    case "mine":
      return (
        <MinePanel
          data={data as StatsMine}
          series={series}
          seriesLoading={seriesLoading}
        />
      );
    case "activity":
      return (
        <ActivityPanel
          data={data as StatsActivity}
          series={series}
          seriesLoading={seriesLoading}
        />
      );
  }
}
