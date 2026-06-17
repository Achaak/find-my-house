import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ReactionListPage } from "@/components/listings/reaction-list-page";
import { api, queryKeys } from "@/lib/api";
import * as m from "@/paraglide/messages.js";

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
      title={m.dislikes_title()}
      description={m.dislikes_desc()}
      query={query}
    />
  );
}
