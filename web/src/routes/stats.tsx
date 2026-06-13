import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const sections = ["overview", "sources", "prices", "mine", "activity"] as const;

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

function StatsPage() {
  const [section, setSection] = useState<(typeof sections)[number]>("overview");

  const query = useQuery({
    queryKey: queryKeys.stats(section),
    queryFn: () => api.stats(section),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          Database stats — same views as <code>/stats</code> on Discord.
        </p>
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
            {item}
          </Button>
        ))}
      </div>
      {query.isLoading ? <p>Loading…</p> : null}
      {query.error ? (
        <p className="text-destructive">{(query.error as Error).message}</p>
      ) : null}
      {query.data ? <StatsPanel section={section} data={query.data} /> : null}
    </div>
  );
}

function StatsPanel({
  section,
  data,
}: {
  section: (typeof sections)[number];
  data: unknown;
}) {
  if (section === "overview") {
    const overview = data as {
      total: number;
      activeProperties: number;
      activePublications: number;
      priceDrops: number;
      likes: number;
      dislikes: number;
      recent: import("@/lib/types").Property[];
    };
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Properties" value={String(overview.total)} />
          <StatCard label="Active" value={String(overview.activeProperties)} />
          <StatCard
            label="Publications"
            value={String(overview.activePublications)}
          />
          <StatCard label="Price drops" value={String(overview.priceDrops)} />
          <StatCard label="Your likes" value={String(overview.likes)} />
          <StatCard label="Your dislikes" value={String(overview.dislikes)} />
        </div>
        {overview.recent.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {overview.recent.map((property) => (
              <PropertyCard key={property.id} property={property} compact />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "prices") {
    const prices = data as {
      priceDrops: number;
      priceStats: {
        min: number | null;
        max: number | null;
        avg: number | null;
      };
      drops: import("@/lib/types").Property[];
    };
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Price drops" value={String(prices.priceDrops)} />
          <StatCard
            label="Average price"
            value={
              prices.priceStats.avg ? formatPrice(prices.priceStats.avg) : "—"
            }
          />
          <StatCard
            label="Range"
            value={
              prices.priceStats.min && prices.priceStats.max
                ? `${formatPrice(prices.priceStats.min)} – ${formatPrice(prices.priceStats.max)}`
                : "—"
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {prices.drops.map((property) => (
            <PropertyCard key={property.id} property={property} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

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
