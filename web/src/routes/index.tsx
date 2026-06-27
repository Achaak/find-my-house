import { createFileRoute, Link } from "@tanstack/react-router";
import { PropertyGridCard } from "@/components/listings/property-grid-card";
import { MiniSparkline } from "@/components/stats/mini-sparkline";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrowseSession } from "@/hooks/use-browse-session";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { useQuery } from "@tanstack/react-query";
import * as m from "@/paraglide/messages.js";
import { cn, formatPrice } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function StatSparkRow({
  label,
  value,
  sparkData,
  dataKey,
  color,
}: {
  label: string;
  value: string | number;
  sparkData: Record<string, string | number | null>[];
  dataKey: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
      <MiniSparkline
        data={sparkData}
        dataKey={dataKey}
        color={color}
        label={label}
      />
    </div>
  );
}

function HomePage() {
  const browseQuery = useBrowseSession();

  const favoritesQuery = useQuery({
    queryKey: queryKeys.reactions("like", {}),
    queryFn: () => api.reactions("like", { limit: 3 }),
  });

  const statsQuery = useQuery({
    queryKey: queryKeys.stats("overview"),
    queryFn: () => api.stats("overview"),
  });

  const seriesQuery = useQuery({
    queryKey: queryKeys.statsSeries("7d"),
    queryFn: () => api.statsSeries("7d"),
  });

  const browseActive =
    browseQuery.data && !browseQuery.data.finished && browseQuery.data.item;

  const snapshots = seriesQuery.data?.snapshots ?? [];
  const reactionSpark =
    seriesQuery.data?.reactions.map((row) => ({
      week: row.week,
      likes: row.likes,
    })) ?? [];

  const statsError = statsQuery.error ?? seriesQuery.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{m.home_dashboard_title()}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {m.home_dashboard_subtitle()}
        </p>
      </div>

      {browseQuery.error ? (
        <Alert variant="destructive">
          {getErrorMessage(browseQuery.error)}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{m.home_card_browse_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {browseActive
                ? m.browse_viewed_count({
                    count: browseQuery.data!.shownCount,
                  })
                : m.home_card_browse_desc()}
            </p>
            <Link to="/browse" className={cn(buttonVariants())}>
              {browseActive ? m.home_resume_browse() : m.home_start_browse()}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.home_stats_flash()}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {statsError ? (
              <Alert variant="destructive">{getErrorMessage(statsError)}</Alert>
            ) : null}
            {statsQuery.data && seriesQuery.data ? (
              <>
                <StatSparkRow
                  label={m.stats_label_active()}
                  value={statsQuery.data.activeProperties}
                  sparkData={snapshots}
                  dataKey="activeProperties"
                  color="var(--primary)"
                />
                <StatSparkRow
                  label={m.stats_label_likes()}
                  value={statsQuery.data.likes}
                  sparkData={reactionSpark}
                  dataKey="likes"
                  color="var(--like)"
                />
                <StatSparkRow
                  label={m.stats_label_price_drops()}
                  value={statsQuery.data.priceDrops}
                  sparkData={snapshots}
                  dataKey="priceDropCount"
                  color="var(--price-drop)"
                />
                {statsQuery.data.priceStats ? (
                  <StatSparkRow
                    label={m.stats_label_median()}
                    value={formatPrice(statsQuery.data.priceStats.median)}
                    sparkData={snapshots}
                    dataKey="medianPrice"
                    color="var(--price-drop)"
                  />
                ) : null}
              </>
            ) : statsQuery.isLoading || seriesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                to="/listings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                {m.home_go_listings()}
              </Link>
              <Link
                to="/stats"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                {m.home_go_stats()}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{m.home_recent_favorites()}</h2>
          <Link
            to="/favorites"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {m.home_view_all_favorites()}
          </Link>
        </div>
        {favoritesQuery.error ? (
          <Alert variant="destructive">
            {getErrorMessage(favoritesQuery.error)}
          </Alert>
        ) : null}
        {favoritesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
        ) : favoritesQuery.data?.items.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoritesQuery.data.items.map((property) => (
              <PropertyGridCard key={property.id} property={property} compact />
            ))}
          </div>
        ) : (
          <EmptyState
            title={m.stats_no_favorites()}
            action={{ label: m.home_go_listings(), to: "/listings" }}
          />
        )}
      </section>
    </div>
  );
}
