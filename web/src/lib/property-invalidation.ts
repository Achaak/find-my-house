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
