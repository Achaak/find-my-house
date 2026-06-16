import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import {
  diagnosticsEmptyMessage,
  type DiagnosticsPreset,
} from "@/lib/property-match-diagnostics-ui";
import type { PropertyMatchDiagnosticItem } from "@/lib/types";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.me,
      queryFn: api.me,
    });
    if (!user.isAdmin) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const scrapeMutation = useMutation({ mutationFn: api.scrape });
  const reconcileMutation = useMutation({ mutationFn: api.reconcile });
  const enrichMutation = useMutation({ mutationFn: api.enrich });
  const [source, setSource] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [bestVeto, setBestVeto] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [diagnostics, setDiagnostics] = useState<PropertyMatchDiagnosticItem[]>(
    []
  );
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [hasLoadedDiagnostics, setHasLoadedDiagnostics] = useState(false);
  const [activePreset, setActivePreset] = useState<DiagnosticsPreset>(null);
  const diagnosticsMutation = useMutation({
    mutationFn: ({
      cursor,
      overrides,
    }: {
      cursor?: number;
      overrides?: {
        source?: string;
        postalCode?: string;
        bestVeto?: string;
        from?: string;
        to?: string;
      };
    }) =>
      api.propertyMatchDiagnostics({
        limit: 20,
        source: (overrides?.source ?? source) || undefined,
        postalCode: (overrides?.postalCode ?? postalCode) || undefined,
        bestVeto: (overrides?.bestVeto ?? bestVeto) || undefined,
        from: (overrides?.from ?? from) || undefined,
        to: (overrides?.to ?? to) || undefined,
        beforeId: cursor,
      }),
    onSuccess: (data, payload) => {
      setHasLoadedDiagnostics(true);
      setDiagnostics((prev) =>
        payload.cursor ? [...prev, ...data.items] : data.items
      );
      setBeforeId(data.nextBeforeId ?? undefined);
    },
  });
  const hasMore = useMemo(() => beforeId !== undefined, [beforeId]);
  const applyPreset = (preset: "price" | "last24h" | "bienici" | "reset") => {
    if (preset === "price") {
      setActivePreset("price");
      setBestVeto("price_out_of_tolerance");
      setBeforeId(undefined);
      diagnosticsMutation.mutate({
        overrides: { bestVeto: "price_out_of_tolerance" },
      });
      return;
    }
    if (preset === "last24h") {
      setActivePreset("last24h");
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const toDate = new Date().toISOString();
      setFrom(fromDate);
      setTo(toDate);
      setBeforeId(undefined);
      diagnosticsMutation.mutate({ overrides: { from: fromDate, to: toDate } });
      return;
    }
    if (preset === "bienici") {
      setActivePreset("bienici");
      setSource("bienici");
      setBeforeId(undefined);
      diagnosticsMutation.mutate({ overrides: { source: "bienici" } });
      return;
    }
    setActivePreset(null);
    setHasLoadedDiagnostics(false);
    setSource("");
    setPostalCode("");
    setBestVeto("");
    setFrom("");
    setTo("");
    setDiagnostics([]);
    setBeforeId(undefined);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manual scrape, enrichment, and reconcile operations (admin only).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Run scrape</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              onClick={() => scrapeMutation.mutate()}
              disabled={scrapeMutation.isPending}
            >
              {scrapeMutation.isPending ? "Running…" : "Scrape now"}
            </Button>
            {scrapeMutation.data ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                {scrapeMutation.data.summary}
              </pre>
            ) : null}
            {scrapeMutation.error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(scrapeMutation.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reconcile properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              {reconcileMutation.isPending ? "Running…" : "Reconcile"}
            </Button>
            {reconcileMutation.data ? (
              <pre className="rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(reconcileMutation.data, null, 2)}
              </pre>
            ) : null}
            {reconcileMutation.error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(reconcileMutation.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Force enrichment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Queue pending listings for display enrichment (same batch as the
              hourly cron).
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
            >
              {enrichMutation.isPending ? "Running…" : "Enrich now"}
            </Button>
            {enrichMutation.data ? (
              <p className="text-sm text-muted-foreground">
                {enrichMutation.data.queued === 0
                  ? "No pending listings to enrich."
                  : `${String(enrichMutation.data.queued)} listing(s) queued.`}
              </p>
            ) : null}
            {enrichMutation.error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(enrichMutation.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Property match diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="diag-source">Source</Label>
                <Input
                  id="diag-source"
                  placeholder="bienici"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-postal">Postal code</Label>
                <Input
                  id="diag-postal"
                  placeholder="75001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-veto">Best veto</Label>
                <Input
                  id="diag-veto"
                  placeholder="price_out_of_tolerance"
                  value={bestVeto}
                  onChange={(e) => setBestVeto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-from">From (ISO)</Label>
                <Input
                  id="diag-from"
                  placeholder="2026-06-16T00:00:00.000Z"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-to">To (ISO)</Label>
                <Input
                  id="diag-to"
                  placeholder="2026-06-16T23:59:59.999Z"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("price")}
              >
                Price veto only
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("last24h")}
              >
                Last 24h
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("bienici")}
              >
                Bienici
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("reset")}
              >
                Reset
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActivePreset("custom");
                  diagnosticsMutation.mutate({});
                }}
                disabled={diagnosticsMutation.isPending}
              >
                {diagnosticsMutation.isPending
                  ? "Loading…"
                  : "Load diagnostics"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  beforeId && diagnosticsMutation.mutate({ cursor: beforeId })
                }
                disabled={
                  diagnosticsMutation.isPending || !beforeId || !hasMore
                }
              >
                Load more
              </Button>
            </div>

            {diagnosticsMutation.isPending ? (
              <div className="space-y-2">
                <div className="h-8 animate-pulse rounded bg-muted" />
                <div className="h-8 animate-pulse rounded bg-muted" />
                <div className="h-8 animate-pulse rounded bg-muted" />
              </div>
            ) : null}

            {diagnosticsMutation.error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(diagnosticsMutation.error)}
              </p>
            ) : null}

            {diagnostics.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2">At</th>
                      <th className="p-2">Listing</th>
                      <th className="p-2">Postal</th>
                      <th className="p-2">Best score</th>
                      <th className="p-2">Best veto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          {item.listingSource}:{item.listingExternalId}
                        </td>
                        <td className="p-2">{item.postalCode ?? "—"}</td>
                        <td className="p-2">
                          {item.bestScore !== null
                            ? item.bestScore.toFixed(3)
                            : "—"}
                        </td>
                        <td className="p-2">{item.bestVeto ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {diagnosticsEmptyMessage(hasLoadedDiagnostics, activePreset)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
