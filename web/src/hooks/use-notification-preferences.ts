import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: () => api.notificationPreferences(),
  });

  const updateMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateNotificationPreferences(enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.notificationPreferences, data);
    },
  });

  function toggle() {
    const nextEnabled = !(preferencesQuery.data?.enabled ?? true);
    updateMutation.mutate(nextEnabled);
  }

  return {
    enabled: preferencesQuery.data?.enabled ?? true,
    isLoading: preferencesQuery.isLoading,
    isPending: updateMutation.isPending,
    toggle,
  };
}
