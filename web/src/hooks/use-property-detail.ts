import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { findCachedListing } from "@/lib/listing-cache";

const ENRICHMENT_POLL_MS = 3_000;

export function usePropertyDetail(propertyId: number | null) {
  const queryClient = useQueryClient();
  const cachedProperty =
    propertyId !== null
      ? findCachedListing(queryClient, propertyId)
      : undefined;

  const listingQuery = useQuery({
    queryKey: queryKeys.listing(propertyId ?? 0),
    queryFn: () => api.listing(propertyId!),
    enabled: propertyId !== null,
    placeholderData: cachedProperty
      ? { item: cachedProperty, enrichment: { status: "pending" as const } }
      : undefined,
    refetchInterval: (query) =>
      query.state.data?.enrichment.status === "pending"
        ? ENRICHMENT_POLL_MS
        : false,
  });

  const addressQuery = useQuery({
    queryKey: queryKeys.address(propertyId ?? 0),
    queryFn: () => api.addressSearch(propertyId!),
    enabled: propertyId !== null,
    refetchInterval: (query) =>
      query.state.data?.enrichment.status === "pending"
        ? ENRICHMENT_POLL_MS
        : false,
  });

  const confirmAddressMutation = useMutation({
    mutationFn: (numeroDpe: string) =>
      api.addressConfirm(propertyId!, numeroDpe),
    onSuccess: () => {
      if (propertyId === null) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.listing(propertyId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.address(propertyId),
      });
    },
  });

  const property = listingQuery.data?.item;
  const isEnrichmentPending =
    listingQuery.data?.enrichment.status === "pending";
  const isRefreshingDetails =
    isEnrichmentPending ||
    (listingQuery.isFetching && listingQuery.isPlaceholderData);

  return {
    listingQuery,
    addressQuery,
    confirmAddressMutation,
    property,
    isEnrichmentPending,
    isRefreshingDetails,
  };
}
