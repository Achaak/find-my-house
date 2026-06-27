import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatSource } from "@/lib/utils";
import type { PropertyPublicationDescription } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

export function PropertyDescriptionTabs({
  descriptions,
  projectedDescription,
}: {
  descriptions: PropertyPublicationDescription[];
  projectedDescription: string | null;
}) {
  const defaultPublicationId = useMemo(
    () => resolveDefaultPublicationId(descriptions, projectedDescription),
    [descriptions, projectedDescription]
  );
  const [activePublicationId, setActivePublicationId] =
    useState(defaultPublicationId);

  const activeDescription =
    descriptions.find(
      (description) => description.id === activePublicationId
    ) ?? descriptions[0];

  if (!activeDescription) return null;

  if (descriptions.length === 1) {
    return (
      <DescriptionPanel
        description={activeDescription.description}
        url={activeDescription.url}
        source={activeDescription.source}
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div
        role="tablist"
        aria-label={m.property_description_tabs_label()}
        className="flex flex-wrap gap-2"
      >
        {descriptions.map((description) => {
          const isActive = description.id === activePublicationId;

          return (
            <button
              key={description.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePublicationId(description.id)}
              className={cn(
                buttonVariants({
                  variant: isActive ? "secondary" : "outline",
                  size: "sm",
                })
              )}
            >
              {formatSource(description.source)}
            </button>
          );
        })}
      </div>
      <DescriptionPanel
        description={activeDescription.description}
        url={activeDescription.url}
        source={activeDescription.source}
      />
    </div>
  );
}

function DescriptionPanel({
  description,
  url,
  source,
}: {
  description: string;
  url: string;
  source: PropertyPublicationDescription["source"];
}) {
  return (
    <div role="tabpanel" className="space-y-2">
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {description}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block text-sm text-primary underline-offset-4 hover:underline"
      >
        {m.property_description_view_listing({ source: formatSource(source) })}
      </a>
    </div>
  );
}

function resolveDefaultPublicationId(
  descriptions: PropertyPublicationDescription[],
  projectedDescription: string | null
): number {
  if (descriptions.length === 0) return 0;

  if (projectedDescription) {
    const matchingDescription = descriptions.find(
      (description) => description.description === projectedDescription
    );
    if (matchingDescription) return matchingDescription.id;
  }

  return descriptions.reduce((longest, description) =>
    description.description.length > longest.description.length
      ? description
      : longest
  ).id;
}
