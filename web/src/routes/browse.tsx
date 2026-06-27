import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BrowseReviewActions } from "@/components/listings/browse-review-actions";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatBrowseCriteria } from "@/lib/listing-filters";
import * as m from "@/paraglide/messages.js";

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

function BrowsePage() {
  const queryClient = useQueryClient();

  const browseQuery = useQuery({
    queryKey: queryKeys.browse,
    queryFn: async () => {
      try {
        return await api.browseCurrent();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: api.browseStart,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.browse, data);
    },
  });

  const stopMutation = useMutation({
    mutationFn: api.browseStop,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.browse, null);
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({
      action,
      propertyId,
    }: {
      action: "like" | "dislike" | "pass";
      propertyId: number;
    }) => api.browseReact(action, propertyId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.browse, data);
    },
  });

  const state = browseQuery.data ?? startMutation.data;
  const mutationError =
    startMutation.error ?? stopMutation.error ?? reactMutation.error ?? null;
  const isReacting = reactMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.browse_title()}</h1>
          <p className="text-sm text-muted-foreground">{m.browse_subtitle()}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || stopMutation.isPending}
          >
            {state ? m.browse_restart() : m.browse_start()}
          </Button>
          {state ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending || startMutation.isPending}
            >
              {m.browse_stop()}
            </Button>
          ) : null}
        </div>
      </div>

      {startMutation.isPending || browseQuery.isLoading ? (
        <p>{m.common_loading()}</p>
      ) : null}

      {browseQuery.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(browseQuery.error)}
        </p>
      ) : null}

      {mutationError ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(mutationError)}
        </p>
      ) : null}

      {state ? (
        <div className="space-y-4">
          {state.criteria ? (
            <p className="text-sm text-muted-foreground">
              {m.browse_criteria_prefix()}{" "}
              {formatBrowseCriteria(state.criteria, state.zoneLabel)}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {m.browse_viewed_count({ count: state.shownCount })}
            {state.isExplore ? m.browse_outside_comfort_zone() : ""}
            {!state.hasPreferences ? m.browse_enable_compatibility() : ""}
          </p>
          {state.finished || !state.item ? (
            <p>{m.browse_finished()}</p>
          ) : (
            <div className="mx-auto w-full max-w-md space-y-4">
              <PropertyCard property={state.item} hideReactions />
              <BrowseReviewActions
                disabled={isReacting}
                onLike={() =>
                  reactMutation.mutate({
                    action: "like",
                    propertyId: state.item!.id,
                  })
                }
                onDislike={() =>
                  reactMutation.mutate({
                    action: "dislike",
                    propertyId: state.item!.id,
                  })
                }
                onPass={() =>
                  reactMutation.mutate({
                    action: "pass",
                    propertyId: state.item!.id,
                  })
                }
              />
            </div>
          )}
        </div>
      ) : browseQuery.isSuccess || startMutation.isSuccess ? (
        <p className="text-muted-foreground">{m.browse_press_start()}</p>
      ) : null}
    </div>
  );
}
