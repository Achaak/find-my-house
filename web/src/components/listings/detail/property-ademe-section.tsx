import { MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-message";
import { googleMapsSearchUrl } from "@/lib/map-utils";
import type { usePropertyDetail } from "@/hooks/use-property-detail";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertyAdemeSection({
  addressQuery,
  confirmAddressMutation,
}: {
  addressQuery: ReturnType<typeof usePropertyDetail>["addressQuery"];
  confirmAddressMutation: ReturnType<
    typeof usePropertyDetail
  >["confirmAddressMutation"];
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">
        {m.listing_detail_ademe_title()}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {m.listing_detail_ademe_desc()}
      </p>
      {addressQuery.isLoading ||
      addressQuery.data?.enrichment.status === "pending" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {addressQuery.data?.enrichment.status === "pending"
            ? m.listing_detail_ademe_enriching()
            : m.listing_detail_ademe_searching()}
        </p>
      ) : null}
      {addressQuery.error ? (
        <p className="mt-4 text-sm text-destructive">
          {getErrorMessage(addressQuery.error)}
        </p>
      ) : null}
      {addressQuery.data?.error ? (
        <p className="mt-4 text-sm text-destructive">
          {addressQuery.data.error}
        </p>
      ) : null}
      {addressQuery.data?.warnings.length ? (
        <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
          {addressQuery.data.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {addressQuery.data?.candidates.length ? (
        <div className="mt-4 space-y-3">
          {addressQuery.data.candidates.map((candidate) => (
            <div
              key={candidate.numeroDpe}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <div className="font-medium">{candidate.address}</div>
                <div className="text-xs text-muted-foreground">
                  {m.listing_detail_dpe_score({
                    numero: candidate.numeroDpe,
                    score: Number.isFinite(candidate.score)
                      ? Math.round(candidate.score)
                      : m.common_em_dash(),
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <a
                  href={googleMapsSearchUrl({
                    address: candidate.address,
                    latitude: candidate.latitude,
                    longitude: candidate.longitude,
                  })}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  <MapPin className="size-4" />
                  {m.listing_detail_google_maps()}
                </a>
                <ConfirmAddressButton
                  numeroDpe={candidate.numeroDpe}
                  confirmAddressMutation={confirmAddressMutation}
                />
              </div>
            </div>
          ))}
        </div>
      ) : addressQuery.data ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {m.listing_detail_ademe_empty()}
        </p>
      ) : null}
    </section>
  );
}

function ConfirmAddressButton({
  numeroDpe,
  confirmAddressMutation,
}: {
  numeroDpe: string;
  confirmAddressMutation: ReturnType<
    typeof usePropertyDetail
  >["confirmAddressMutation"];
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={confirmAddressMutation.isPending}
        onClick={() => confirmAddressMutation.mutate(numeroDpe)}
      >
        {confirmAddressMutation.isPending
          ? m.common_saving()
          : m.listing_detail_confirm()}
      </Button>
      {confirmAddressMutation.isSuccess ? (
        <span className="text-xs text-muted-foreground">
          {m.listing_detail_address_saved({
            numero: confirmAddressMutation.data.dpeNumero,
          })}
        </span>
      ) : null}
      {confirmAddressMutation.error ? (
        <span className="text-xs text-destructive">
          {getErrorMessage(confirmAddressMutation.error)}
        </span>
      ) : null}
    </div>
  );
}
