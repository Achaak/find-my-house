import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CompatibilityProfilePanel } from "@/components/listings/compatibility-detail";
import { ReactionListPage } from "@/components/listings/reaction-list-page";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";

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
          Active
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(true)}
        >
          Archived
        </Button>
      </div>
      <ReactionListPage
        title={showArchived ? "Archived favorites" : "Favorites"}
        description={
          showArchived
            ? "Archived favorites still count toward compatibility scoring."
            : "Listings you liked."
        }
        query={query}
      />
    </div>
  );
}
