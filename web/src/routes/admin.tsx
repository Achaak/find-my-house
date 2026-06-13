import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const scrapeMutation = useMutation({ mutationFn: api.scrape });
  const reconcileMutation = useMutation({ mutationFn: api.reconcile });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manual scrape and reconcile — same as <code>/scraper</code> and{" "}
          <code>/reconcile</code> on Discord (admin only).
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
                {(scrapeMutation.error as Error).message}
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
                {(reconcileMutation.error as Error).message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
