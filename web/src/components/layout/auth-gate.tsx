import {
  ApiError,
  clearHaToken,
  getHaToken,
  setHaToken,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";

export function AuthGate({
  children,
  loading,
  error,
}: {
  children: React.ReactNode;
  loading: boolean;
  error: unknown;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(getHaToken() ?? "");
  const unauthorized = error instanceof ApiError && error.status === 401;

  if (loading && !unauthorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Connecting…
      </div>
    );
  }

  if (unauthorized || (!loading && error && !getHaToken())) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Home Assistant authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Open this app from Home Assistant Ingress, or paste a long-lived
              access token for local development.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ha-token">Long-lived access token</Label>
              <Input
                id="ha-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="eyJ..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setHaToken(token.trim());
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.me,
                  });
                }}
              >
                Save token
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearHaToken();
                  setToken("");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !unauthorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4 text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  return children;
}
