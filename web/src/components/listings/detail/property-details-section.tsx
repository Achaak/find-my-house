import { PropertyPortalLinks } from "@/components/listings/property-portal-links";
import { formatLocaleDateTime } from "@/lib/locale";
import type { Property } from "@find-my-house/api-types";
import { formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertyDetailsSection({ property }: { property: Property }) {
  const emDash = m.common_em_dash();

  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">
        {m.listing_detail_details_title()}
      </h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Detail
          label={m.detail_address()}
          value={property.address ?? m.common_unknown()}
        />
        <Detail
          label={m.detail_type()}
          value={property.propertyType ?? emDash}
        />
        <Detail
          label={m.detail_price_per_m2()}
          value={
            property.surface
              ? formatPrice(Math.round(property.price / property.surface))
              : emDash
          }
        />
        <Detail label={m.detail_dpe()} value={property.dpeClass ?? emDash} />
        <Detail label={m.detail_ges()} value={property.gesClass ?? emDash} />
        <Detail
          label={m.detail_dpe_consumption()}
          value={
            property.dpeConsumptionKwhM2
              ? `${String(property.dpeConsumptionKwhM2)} ${m.unit_kwh_m2()}`
              : emDash
          }
        />
        <Detail
          label={m.detail_ges_emissions()}
          value={
            property.gesEmissionKgM2
              ? `${String(property.gesEmissionKgM2)} ${m.unit_kg_co2_m2()}`
              : emDash
          }
        />
        <Detail
          label={m.detail_bathrooms()}
          value={property.bathrooms ? String(property.bathrooms) : emDash}
        />
        <Detail
          label={m.detail_construction_year()}
          value={
            property.constructionYear
              ? String(property.constructionYear)
              : emDash
          }
        />
        <Detail label={m.detail_heating()} value={property.heating ?? emDash} />
        <Detail
          label={m.detail_orientation()}
          value={property.orientation ?? emDash}
        />
        <Detail
          label={m.detail_condition()}
          value={property.propertyCondition ?? emDash}
        />
        <Detail
          label={m.detail_parking()}
          value={
            property.parkingSpaces ? String(property.parkingSpaces) : emDash
          }
        />
        <Detail
          label={m.detail_first_price()}
          value={formatPrice(property.firstPrice)}
        />
        <Detail
          label={m.detail_first_seen()}
          value={formatLocaleDateTime(property.firstSeenAt)}
        />
      </dl>
      {property.highlights?.length ? (
        <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
          {property.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      ) : null}
      {property.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {property.description}
        </p>
      ) : null}
      <div className="mt-4">
        <PropertyPortalLinks
          property={property}
          variant="badge"
          showUnavailableMessage
        />
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
