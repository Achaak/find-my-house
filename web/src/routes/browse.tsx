import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowseUndoToast } from "@/components/listings/browse-undo-toast";
import {
  BrowsePropertyCard,
  BrowsePropertyCardSkeleton,
} from "@/components/listings/browse-property-card";
import { BrowseReviewActions } from "@/components/listings/browse-review-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useBrowseKeyboard } from "@/hooks/use-browse-keyboard";
import { useBrowseSession } from "@/hooks/use-browse-session";
import type { SwipeDirection } from "@/hooks/use-swipe-gesture";
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
): SwipeDirection {
  if (action === "like") return "right";
  if (action === "dislike") return "left";
  return "up";
}

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
});

function BrowsePage() {
  const queryClient = useQueryClient();
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(
    null
  );
  const [undoState, setUndoState] = useState<NonNullable<
    BrowseState["undoDislike"]
  > | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const browseQuery = useBrowseSession();

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
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.browse, data);
      invalidateReactionSideEffects(queryClient);
      invalidatePropertyQueries(queryClient, variables.propertyId);
      if (data.undoDislike) {
        setUndoState(data.undoDislike);
      }
    },
  });

  const undoMutation = useMutation({
    mutationFn: (propertyId: number) => api.undoDislike(propertyId),
    onSuccess: (data, propertyId) => {
      setUndoState(null);
      if (data.browse) {
        queryClient.setQueryData(queryKeys.browse, data.browse);
      }
      invalidateReactionSideEffects(queryClient);
      invalidatePropertyQueries(queryClient, propertyId);
    },
  });

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    []
  );

  const state = browseQuery.data ?? startMutation.data;
  const mutationError =
    startMutation.error ??
    stopMutation.error ??
    reactMutation.error ??
    undoMutation.error ??
    null;
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

  const currentProperty = state?.item;
  useBrowseKeyboard({
    enabled: Boolean(currentProperty && !state?.finished && !isReacting),
    onLike: () => {
      if (currentProperty) handleReact("like", currentProperty.id);
    },
    onDislike: () => {
      if (currentProperty) handleReact("dislike", currentProperty.id);
    },
    onPass: () => {
      if (currentProperty) handleReact("pass", currentProperty.id);
    },
  });

  const showEmptyStart =
    !state && (browseQuery.isSuccess || startMutation.isSuccess);

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
            <p className="text-xs text-muted-foreground">
              {m.browse_swipe_hint()}
            </p>
            <p className="hidden text-xs text-muted-foreground md:block">
              {m.browse_keyboard_hint()}
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
              action={{ label: m.browse_start(), to: "/browse" }}
            />
          ) : (
            <>
              <div className="-mx-4 flex flex-1 items-center py-2 md:mx-0 md:py-4">
                <BrowsePropertyCard
                  property={state.item}
                  disabled={isReacting}
                  exitDirection={exitDirection}
                  onLike={() => handleReact("like", state.item!.id)}
                  onDislike={() => handleReact("dislike", state.item!.id)}
                  onPass={() => handleReact("pass", state.item!.id)}
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
