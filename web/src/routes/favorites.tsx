import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CompatibilityProfilePanel } from "@/components/listings/compatibility-detail";
import { ReactionListPage } from "@/components/listings/reaction-list-page";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import * as m from "@/paraglide/messages.js";

export const Route = createFileRoute("/favorites")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const [showArchived, setShowArchived] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.compatibilityProfile,
    queryFn: () => api.compatibilityProfile(),
  });

  const query = useQuery({
    queryKey: queryKeys.reactions("like", {
      archivedOnly: showArchived,
    }),
    queryFn: () =>
      api.reactions("like", {
        limit: 100,
        archivedOnly: showArchived,
      }),
  });

  return (
    <div className="space-y-4">
      {profileQuery.data ? (
        <CompatibilityProfilePanel profile={profileQuery.data} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(false)}
        >
          {m.favorites_tab_active()}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(true)}
        >
          {m.favorites_tab_archived()}
        </Button>
      </div>
      <ReactionListPage
        title={
          showArchived ? m.favorites_title_archived() : m.favorites_title()
        }
        description={
          showArchived ? m.favorites_desc_archived() : m.favorites_desc()
        }
        query={query}
      />
    </div>
  );
}
