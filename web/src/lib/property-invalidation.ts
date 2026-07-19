import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";

export function invalidatePropertyQueries(
  queryClient: QueryClient,
  propertyId: number
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.listing(propertyId),
  });
  void queryClient.invalidateQueries({ queryKey: ["listings"] });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.reactions("like"),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.reactions("dislike"),
  });
}

/**
 * Refresh aggregate views after a reaction or browse undo.
 * Does not invalidate the browse session query — callers that already
 * `setQueryData(queryKeys.browse, …)` from a mutation must not refetch,
 * or a slower in-flight GET can overwrite the newer card.
 */
export function invalidateReactionSideEffects(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["stats"] });
  void queryClient.invalidateQueries({ queryKey: ["stats-series"] });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.compatibilityProfile,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.reactions("like"),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.reactions("dislike"),
  });
}
