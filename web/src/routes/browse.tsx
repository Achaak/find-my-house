import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowseUndoToast } from "@/components/listings/browse-undo-toast";
import {
  BrowsePropertyCard,
  BrowsePropertyCardSkeleton,
  type BrowseExitDirection,
} from "@/components/listings/browse-property-card";
import { BrowseReviewActions } from "@/components/listings/browse-review-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useBrowseSession } from "@/hooks/use-browse-session";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import {
  invalidatePropertyQueries,
  invalidateReactionSideEffects,
} from "@/lib/property-invalidation";
import { formatBrowseCriteria } from "@/lib/listing-filters";
import type { BrowseState } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

const EXIT_MS = 220;

function exitDirectionForAction(
  action: "like" | "dislike" | "pass"
): BrowseExitDirection {
  if (action === "like") return "right";
  if (action === "dislike") return "left";
  return "up";
}

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

function BrowsePage() {
  const queryClient = useQueryClient();
  const [exitDirection, setExitDirection] =
    useState<BrowseExitDirection | null>(null);
  const [undoState, setUndoState] = useState<NonNullable<
    BrowseState["undoDislike"]
  > | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const exitTimerRef = useRef<number | null>(null);

  const browseQuery = useBrowseSession();

  const startMutation = useMutation({
    mutationFn: api.browseStart,
    onSuccess: (data) => {
      setMutationError(null);
      queryClient.setQueryData(queryKeys.browse, data);
    },
    onError: (error) => setMutationError(error),
  });

  const stopMutation = useMutation({
    mutationFn: api.browseStop,
    onSuccess: () => {
      setMutationError(null);
      queryClient.setQueryData(queryKeys.browse, null);
      setUndoState(null);
    },
    onError: (error) => setMutationError(error),
  });

  const reactMutation = useMutation({
    mutationFn: ({
      action,
      propertyId,
    }: {
      action: "like" | "dislike" | "pass";
      propertyId: number;
    }) => api.browseReact(action, propertyId),
    onSuccess: (data, variables) => {
      setMutationError(null);
      // Clear exit before swapping the card so the next house does not mount
      // already opacity-0 (and so a key change cannot inherit the exit class).
      setExitDirection(null);
      queryClient.setQueryData(queryKeys.browse, data);
      invalidateReactionSideEffects(queryClient);
      invalidatePropertyQueries(queryClient, variables.propertyId);
      if (data.undoDislike) {
        setUndoState(data.undoDislike);
      }
    },
    onError: (error) => setMutationError(error),
  });

  const undoMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const data = await api.undoDislike(propertyId);
      if (data.status !== "removed") {
        throw new Error(m.browse_undo_failed());
      }
      return data;
    },
    onSuccess: (data, propertyId) => {
      setMutationError(null);
      setUndoState(null);
      if (data.browse) {
        queryClient.setQueryData(queryKeys.browse, data.browse);
      }
      invalidateReactionSideEffects(queryClient);
      invalidatePropertyQueries(queryClient, propertyId);
    },
    onError: (error) => setMutationError(error),
  });

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    []
  );

  // Prefer the live browse query only — never fall back to a stale
  // startMutation payload after stop (null must win over ??).
  const state = browseQuery.data ?? undefined;
  const isReacting = reactMutation.isPending || Boolean(exitDirection);

  const handleReact = useCallback(
    (action: "like" | "dislike" | "pass", propertyId: number) => {
      if (isReacting) return;
      setUndoState(null);
      setExitDirection(exitDirectionForAction(action));
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      exitTimerRef.current = window.setTimeout(() => {
        reactMutation.mutate(
          { action, propertyId },
          { onSettled: () => setExitDirection(null) }
        );
      }, EXIT_MS);
    },
    [isReacting, reactMutation]
  );

  const showEmptyStart =
    !state && browseQuery.isFetched && !browseQuery.isError;

  return (
    <div className="flex flex-col gap-6">
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
        <BrowsePropertyCardSkeleton />
      ) : null}

      {browseQuery.error ? (
        <Alert variant="destructive">
          {getErrorMessage(browseQuery.error)}
        </Alert>
      ) : null}

      {mutationError ? (
        <Alert variant="destructive">{getErrorMessage(mutationError)}</Alert>
      ) : null}

      {state ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-2">
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
          </div>

          {undoState ? (
            <BrowseUndoToast
              propertyId={undoState.propertyId}
              undoUntil={undoState.undoUntil}
              onUndo={(propertyId) => undoMutation.mutate(propertyId)}
              onDismiss={() => setUndoState(null)}
            />
          ) : null}

          {state.finished || !state.item ? (
            <EmptyState
              className="flex-1 justify-center py-10"
              title={m.browse_empty_finished_title()}
              description={m.browse_empty_finished_desc()}
              action={{
                label: m.browse_start(),
                onClick: () => startMutation.mutate(),
              }}
            />
          ) : (
            <>
              <div className="-mx-4 flex flex-1 items-center py-2 md:mx-0 md:py-4">
                <BrowsePropertyCard
                  key={state.item.id}
                  property={state.item}
                  exitDirection={exitDirection}
                />
              </div>
              <BrowseReviewActions
                disabled={isReacting}
                className="border-t bg-background/95 px-2 py-4 backdrop-blur lg:border-0 lg:bg-transparent lg:px-0 lg:py-3"
                onLike={() => handleReact("like", state.item!.id)}
                onDislike={() => handleReact("dislike", state.item!.id)}
                onPass={() => handleReact("pass", state.item!.id)}
              />
            </>
          )}
        </div>
      ) : showEmptyStart ? (
        <div className="flex flex-1 flex-col gap-6 pb-2">
          <EmptyState
            className="flex-1 justify-center py-10"
            title={m.browse_empty_start_title()}
            description={m.browse_empty_start_desc()}
          />
          <Button
            type="button"
            className="w-full sm:w-auto sm:self-start"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {m.browse_empty_start_action()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
