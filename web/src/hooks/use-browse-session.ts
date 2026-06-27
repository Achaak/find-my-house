import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { ApiError } from "@/lib/api-client";

export function useBrowseSession() {
  return useQuery({
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
}
