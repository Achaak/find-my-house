import { ChevronDown, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDisplayPublications } from "@/lib/publications";
import type { Property } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";
import { cn, formatSource } from "@/lib/utils";

export function PropertyPortalLinks({
  property,
  className,
  variant = "button",
  showUnavailableMessage = false,
}: {
  property: Pick<Property, "publications">;
  className?: string;
  variant?: "button" | "badge";
  showUnavailableMessage?: boolean;
}) {
  const publications = getDisplayPublications(property);

  if (publications.length === 0) {
    if (!showUnavailableMessage) {
      return null;
    }

    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {m.publications_unavailable_detail()}
      </p>
    );
  }

  if (publications.length === 1) {
    const publication = publications[0]!;
    const label = formatSource(publication.source);

    return (
      <a
        href={publication.url}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          buttonVariants({
            variant: variant === "badge" ? "outline" : "ghost",
            size: "sm",
          }),
          className
        )}
      >
        <ExternalLink className="size-4" />
        {label}
      </a>
    );
  }

  const triggerVariant = variant === "badge" ? "outline" : "ghost";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={triggerVariant} size="sm" className={className} />
        }
      >
        <ExternalLink className="size-4" />
        {m.portal_dropdown_label()}
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {publications.map((publication) => {
          const label = formatSource(publication.source);

          return (
            <DropdownMenuItem
              key={publication.key}
              render={
                <a
                  href={publication.url}
                  target="_blank"
                  rel="noreferrer noopener"
                />
              }
              nativeButton={false}
            >
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
