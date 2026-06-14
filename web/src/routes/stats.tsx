import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { StatsSection } from "@/lib/types";
import { StatsPanel } from "@/components/stats/stats-panels";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";

const sections: StatsSection[] = [
  "overview",
  "sources",
  "prices",
  "mine",
  "activity",
];

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});

function StatsPage() {
  const [section, setSection] = useState<StatsSection>("overview");

  const query = useQuery({
    queryKey: queryKeys.stats(section),
    queryFn: () => api.stats(section),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          Database overview, sources, prices, and activity.
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
        <p className="text-destructive">{getErrorMessage(query.error)}</p>
      ) : null}
      {query.data ? <StatsPanel section={section} data={query.data} /> : null}
    </div>
  );
}
