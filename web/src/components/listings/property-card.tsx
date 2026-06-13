import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Heart, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import type { Property } from "@/lib/types";
import { formatPrice, formatSource } from "@/lib/utils";

export function PropertyCard({
  property,
  compact = false,
}: {
  property: Property;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => api.addReaction("like", property.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.listing(property.id),
      });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("like"),
      });
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: () => api.addReaction("dislike", property.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.listing(property.id),
      });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("dislike"),
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (type: "like" | "dislike") =>
      api.removeReaction(type, property.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.listing(property.id),
      });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("like"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reactions("dislike"),
      });
    },
  });

  return (
    <Card className="overflow-hidden">
      {property.imageUrl ? (
        <img
          src={property.imageUrl}
          alt=""
          className={
            compact ? "h-40 w-full object-cover" : "h-52 w-full object-cover"
          }
        />
      ) : (
        <div
          className={
            compact
              ? "flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground"
              : "flex h-52 items-center justify-center bg-muted text-sm text-muted-foreground"
          }
        >
          No photo
        </div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-start gap-2">
          <Badge variant="secondary">#{property.id}</Badge>
          <Badge variant="outline">{formatSource(property.source)}</Badge>
          {property.compatibilityScore !== undefined ? (
            <Badge>Compat {Math.round(property.compatibilityScore)}%</Badge>
          ) : null}
          {property.reaction === "like" ? (
            <Badge variant="default">Liked</Badge>
          ) : null}
          {property.reaction === "dislike" ? (
            <Badge variant="secondary">Disliked</Badge>
          ) : null}
        </div>
        <CardTitle className="line-clamp-2">{property.title}</CardTitle>
        <CardDescription>
          {property.city}
          {property.postalCode ? ` (${property.postalCode})` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-2xl font-semibold">
          {formatPrice(property.price)}
        </div>
        <div className="flex flex-wrap gap-3 text-muted-foreground">
          {property.surface ? <span>{property.surface} m²</span> : null}
          {property.landSurface ? (
            <span>{property.landSurface} m² land</span>
          ) : null}
          {property.rooms ? <span>{property.rooms} rooms</span> : null}
          {property.bedrooms ? <span>{property.bedrooms} beds</span> : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Link to="/listings/$id" params={{ id: String(property.id) }}>
          <Button type="button">Details</Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            property.reaction === "like"
              ? removeMutation.mutate("like")
              : likeMutation.mutate()
          }
        >
          <Heart className="size-4" />
          {property.reaction === "like" ? "Unlike" : "Like"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            property.reaction === "dislike"
              ? removeMutation.mutate("dislike")
              : dislikeMutation.mutate()
          }
        >
          <ThumbsDown className="size-4" />
          {property.reaction === "dislike" ? "Undo" : "Dislike"}
        </Button>
        <a href={property.url} target="_blank" rel="noreferrer noopener">
          <Button variant="ghost" size="sm" type="button">
            <ExternalLink className="size-4" />
            Portal
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
}
