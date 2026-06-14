import { QueryClient, useQuery } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/layout/auth-gate";
import { api, queryKeys } from "@/lib/api";

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    retry: false,
  });
  const versionQuery = useQuery({
    queryKey: queryKeys.version,
    queryFn: api.version,
  });

  return (
    <AuthGate error={meQuery.error} loading={meQuery.isLoading}>
      <AppShell
        user={meQuery.data}
        version={versionQuery.data?.version}
        commit={versionQuery.data?.commit}
      >
        <Outlet />
      </AppShell>
    </AuthGate>
  );
}
