import { CompatibilityBadge } from "@/components/listings/compatibility-badge";
import { Badge } from "@/components/ui/badge";
import type { PropertySummaryBadge } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertySummaryBadges({
  property,
  badges,
}: {
  property: Property;
  badges: PropertySummaryBadge[];
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {badges.map((badge) => {
        switch (badge.kind) {
          case "id":
            return (
              <Badge key="id" variant="secondary">
                #{badge.id}
              </Badge>
            );
          case "source":
            return (
              <a
                key={badge.source}
                href={badge.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {formatSource(badge.source)}
              </a>
            );
          case "publications-unavailable":
            return (
              <Badge key="unavailable" variant="outline">
                {m.publications_unavailable_badge()}
              </Badge>
            );
          case "compatibility":
            return property.compatibility ? (
              <CompatibilityBadge
                key="compat"
                compatibility={property.compatibility}
              />
            ) : null;
          case "price-drop":
            return (
              <Badge
                key="price-drop"
                variant="default"
                className="bg-price-drop"
              >
                {badge.label}
              </Badge>
            );
          case "reaction-like":
            return (
              <Badge key="like" className="bg-like text-like-foreground">
                {m.reaction_like()}
              </Badge>
            );
          case "reaction-dislike":
            return (
              <Badge
                key="dislike"
                variant="outline"
                className="border-dislike text-dislike"
              >
                {m.reaction_dislike()}
              </Badge>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
