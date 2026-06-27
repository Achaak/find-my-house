import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { formatLocaleDateTime } from "@/lib/locale";
import {
  diagnosticsEmptyMessage,
  type DiagnosticsPreset,
} from "@/lib/property-match-diagnostics-ui";
import type {
  ListingSource,
  PropertyMatchDiagnosticItem,
} from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

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
  const notificationTestMutation = useMutation({
    mutationFn: api.testNotification,
  });
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
  const emDash = m.common_em_dash();

  const toListingSource = (value: string): ListingSource | undefined => {
    if (!value) return undefined;
    const allowed: ListingSource[] = [
      "bienici",
      "seloger",
      "leboncoin",
      "logicimmo",
    ];
    return allowed.includes(value as ListingSource)
      ? (value as ListingSource)
      : undefined;
  };
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
        source: toListingSource((overrides?.source ?? source) || ""),
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
        <h1 className="text-2xl font-semibold">{m.admin_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.admin_subtitle()}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{m.admin_scrape_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              onClick={() => scrapeMutation.mutate()}
              disabled={scrapeMutation.isPending}
            >
              {scrapeMutation.isPending
                ? m.common_running()
                : m.admin_scrape_run()}
            </Button>
            {scrapeMutation.data ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                {scrapeMutation.data.summary}
              </pre>
            ) : null}
            {scrapeMutation.error ? (
              <Alert variant="destructive">
                {getErrorMessage(scrapeMutation.error)}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.admin_reconcile_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              {reconcileMutation.isPending
                ? m.common_running()
                : m.admin_reconcile_run()}
            </Button>
            {reconcileMutation.data ? (
              <pre className="rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(reconcileMutation.data, null, 2)}
              </pre>
            ) : null}
            {reconcileMutation.error ? (
              <Alert variant="destructive">
                {getErrorMessage(reconcileMutation.error)}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.admin_enrich_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {m.admin_enrich_desc()}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
            >
              {enrichMutation.isPending
                ? m.common_running()
                : m.admin_enrich_run()}
            </Button>
            {enrichMutation.data ? (
              <p className="text-sm text-muted-foreground">
                {enrichMutation.data.queued === 0
                  ? m.admin_enrich_none()
                  : m.admin_enrich_queued({
                      count: enrichMutation.data.queued,
                    })}
              </p>
            ) : null}
            {enrichMutation.error ? (
              <Alert variant="destructive">
                {getErrorMessage(enrichMutation.error)}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.admin_notifications_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {m.admin_notifications_desc()}
            </p>
            <p className="text-sm text-muted-foreground">
              {m.admin_notifications_hint()}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => notificationTestMutation.mutate()}
              disabled={notificationTestMutation.isPending}
            >
              {notificationTestMutation.isPending
                ? m.common_running()
                : m.admin_notifications_run()}
            </Button>
            {notificationTestMutation.data ? (
              <Alert>
                {m.admin_notifications_success({
                  services:
                    notificationTestMutation.data.notifyServices.join(", "),
                })}
              </Alert>
            ) : null}
            {notificationTestMutation.error ? (
              <Alert variant="destructive">
                {getErrorMessage(notificationTestMutation.error)}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{m.admin_diagnostics_title()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="diag-source">{m.admin_diag_source()}</Label>
                <Input
                  id="diag-source"
                  placeholder="bienici"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-postal">{m.admin_diag_postal()}</Label>
                <Input
                  id="diag-postal"
                  placeholder="75001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-veto">{m.admin_diag_veto()}</Label>
                <Input
                  id="diag-veto"
                  placeholder="price_out_of_tolerance"
                  value={bestVeto}
                  onChange={(e) => setBestVeto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-from">{m.admin_diag_from()}</Label>
                <Input
                  id="diag-from"
                  placeholder="2026-06-16T00:00:00.000Z"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="diag-to">{m.admin_diag_to()}</Label>
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
                {m.admin_preset_price()}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("last24h")}
              >
                {m.admin_preset_last24h()}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("bienici")}
              >
                {m.admin_preset_bienici()}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyPreset("reset")}
              >
                {m.admin_preset_reset()}
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
                  ? m.common_loading()
                  : m.admin_diagnostics_load()}
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
                {m.common_load_more()}
              </Button>
            </div>

            {diagnosticsMutation.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : null}

            {diagnosticsMutation.error ? (
              <Alert variant="destructive">
                {getErrorMessage(diagnosticsMutation.error)}
              </Alert>
            ) : null}

            {diagnostics.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2">{m.admin_table_at()}</th>
                      <th className="p-2">{m.admin_table_listing()}</th>
                      <th className="p-2">{m.admin_table_postal()}</th>
                      <th className="p-2">{m.admin_table_score()}</th>
                      <th className="p-2">{m.admin_table_veto()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">
                          {formatLocaleDateTime(item.createdAt)}
                        </td>
                        <td className="p-2">
                          {item.listingSource}:{item.listingExternalId}
                        </td>
                        <td className="p-2">{item.postalCode ?? emDash}</td>
                        <td className="p-2">
                          {item.bestScore !== null
                            ? item.bestScore.toFixed(3)
                            : emDash}
                        </td>
                        <td className="p-2">{item.bestVeto ?? emDash}</td>
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
