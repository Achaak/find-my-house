import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { StatsSection } from "@find-my-house/api-types";
import { StatsPanel } from "@/components/stats/stats-panels";
import { Button } from "@/components/ui/button";
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

  const query = useQuery({
    queryKey: queryKeys.stats(section),
    queryFn: () => api.stats(section),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{m.stats_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.stats_subtitle()}</p>
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
      {query.isLoading ? <p>{m.common_loading()}</p> : null}
      {query.error ? (
        <p className="text-destructive">{getErrorMessage(query.error)}</p>
      ) : null}
      {query.data ? <StatsPanel section={section} data={query.data} /> : null}
    </div>
  );
}
