import {
  ApiError,
  clearHaToken,
  getHaToken,
  hasEnvHaToken,
  hasStoredHaToken,
  setHaToken,
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import * as m from "@/paraglide/messages.js";

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
  const envTokenActive = hasEnvHaToken() && !hasStoredHaToken();

  if (loading && !unauthorized) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {m.auth_connecting()}
      </div>
    );
  }

  if (unauthorized || (!loading && error && !getHaToken())) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{m.auth_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{m.auth_body()}</p>
            {envTokenActive ? (
              <p className="text-sm text-muted-foreground">
                {m.auth_env_token_hint()}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ha-token">{m.auth_token_label()}</Label>
              <Input
                id="ha-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={m.auth_token_placeholder()}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!token.trim()}
                onClick={() => {
                  setHaToken(token.trim());
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.me,
                  });
                }}
              >
                {m.auth_save_token()}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={envTokenActive}
                onClick={() => {
                  clearHaToken();
                  setToken("");
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.me,
                  });
                }}
              >
                {m.auth_clear_token()}
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
        {getErrorMessage(error)}
      </div>
    );
  }

  return children;
}
