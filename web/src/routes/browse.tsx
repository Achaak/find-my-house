import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatBrowseCriteria } from "@/lib/listing-filters";

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
      action: "like" | "dislike";
      propertyId: number;
    }) => api.browseReact(action, propertyId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.browse, data);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("like"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("dislike"),
      });
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
          <h1 className="text-2xl font-semibold">Browse</h1>
          <p className="text-sm text-muted-foreground">
            Review listings one at a time with like or dislike.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || stopMutation.isPending}
          >
            {state ? "Restart" : "Start"}
          </Button>
          {state ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending || startMutation.isPending}
            >
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      {startMutation.isPending || browseQuery.isLoading ? (
        <p>Loading…</p>
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
              Criteria: {formatBrowseCriteria(state.criteria, state.zoneLabel)}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {state.shownCount} viewed
            {state.isExplore ? " · outside comfort zone" : ""}
            {!state.hasPreferences
              ? " · like listings to enable compatibility"
              : ""}
          </p>
          {state.finished || !state.item ? (
            <p>No more listings to browse with current criteria.</p>
          ) : (
            <>
              <PropertyCard property={state.item} hideReactions />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={isReacting}
                  onClick={() =>
                    reactMutation.mutate({
                      action: "like",
                      propertyId: state.item!.id,
                    })
                  }
                >
                  {isReacting ? "Saving…" : "Like & next"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isReacting}
                  onClick={() =>
                    reactMutation.mutate({
                      action: "dislike",
                      propertyId: state.item!.id,
                    })
                  }
                >
                  {isReacting ? "Saving…" : "Dislike & next"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : browseQuery.isSuccess || startMutation.isSuccess ? (
        <p className="text-muted-foreground">Press Start to begin browsing.</p>
      ) : null}
    </div>
  );
}
