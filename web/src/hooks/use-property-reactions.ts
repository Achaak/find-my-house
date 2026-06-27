import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  invalidatePropertyQueries,
  invalidateReactionSideEffects,
} from "@/lib/property-invalidation";
import type { Property } from "@find-my-house/api-types";

export function usePropertyReactions(property: Property) {
  const queryClient = useQueryClient();

  const onSuccess = () => {
    invalidatePropertyQueries(queryClient, property.id);
    invalidateReactionSideEffects(queryClient);
  };

  const likeMutation = useMutation({
    mutationFn: () => api.addReaction("like", property.id),
    onSuccess,
  });

  const dislikeMutation = useMutation({
    mutationFn: () => api.addReaction("dislike", property.id),
    onSuccess,
  });

  const removeMutation = useMutation({
    mutationFn: (type: "like" | "dislike") =>
      api.removeReaction(type, property.id),
    onSuccess,
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      property.archived
        ? api.unarchiveLike(property.id)
        : api.archiveLike(property.id),
    onSuccess,
  });

  const isPending =
    likeMutation.isPending ||
    dislikeMutation.isPending ||
    removeMutation.isPending ||
    archiveMutation.isPending;

  const error =
    likeMutation.error ??
    dislikeMutation.error ??
    removeMutation.error ??
    archiveMutation.error ??
    null;

  return {
    isPending,
    error,
    like: () => likeMutation.mutate(),
    dislike: () => dislikeMutation.mutate(),
    remove: (type: "like" | "dislike") => removeMutation.mutate(type),
    toggleArchive: () => archiveMutation.mutate(),
  };
}
