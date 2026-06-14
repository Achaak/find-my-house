import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ReactionListPage } from "@/components/listings/reaction-list-page";
import { api, queryKeys } from "@/lib/api";

export const Route = createFileRoute("/dislikes")({
  component: DislikesPage,
});

function DislikesPage() {
  const query = useQuery({
    queryKey: queryKeys.reactions("dislike"),
    queryFn: () => api.reactions("dislike", { limit: 100 }),
  });

  return (
    <ReactionListPage
      title="Dislikes"
      description="Listings you disliked."
      query={query}
    />
  );
}
