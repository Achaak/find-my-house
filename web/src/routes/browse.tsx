import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

function BrowsePage() {
  const queryClient = useQueryClient();

  const browseQuery = useQuery({
    queryKey: queryKeys.browse,
    queryFn: api.browseCurrent,
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
      queryClient.removeQueries({ queryKey: queryKeys.browse });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Browse</h1>
          <p className="text-sm text-muted-foreground">
            One listing at a time — like Discord <code>/browse</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {state ? "Restart" : "Start"}
          </Button>
          {state ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      {startMutation.isPending || browseQuery.isLoading ? (
        <p>Loading…</p>
      ) : null}

      {state ? (
        <div className="space-y-4">
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
              <PropertyCard property={state.item} />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    reactMutation.mutate({
                      action: "like",
                      propertyId: state.item!.id,
                    })
                  }
                >
                  Like & next
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    reactMutation.mutate({
                      action: "dislike",
                      propertyId: state.item!.id,
                    })
                  }
                >
                  Dislike & next
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Press Start to begin browsing.</p>
      )}
    </div>
  );
}
