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
import { cn, formatSource } from "@/lib/utils";

export function PropertyPortalLinks({
  property,
  className,
  variant = "button",
}: {
  property: Pick<Property, "publications" | "source" | "url">;
  className?: string;
  variant?: "button" | "badge";
}) {
  const publications = getDisplayPublications(property);

  if (publications.length === 1) {
    const publication = publications[0]!;
    const label = formatSource(publication.source);
    const inactiveSuffix = publication.isActive ? "" : " (inactive)";

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
        {inactiveSuffix}
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
        Portails
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {publications.map((publication) => {
          const label = formatSource(publication.source);
          const inactiveSuffix = publication.isActive ? "" : " (inactive)";

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
              {inactiveSuffix}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
