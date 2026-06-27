import { Archive, Heart, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { usePropertyReactions } from "@/hooks/use-property-reactions";
import type { Property } from "@find-my-house/api-types";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertyReactionActions({
  property,
  reactions,
}: {
  property: Property;
  reactions: ReturnType<typeof usePropertyReactions>;
}) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={reactions.isPending}
        className={cn(
          property.reaction === "like" &&
            "border-like bg-like/10 text-like hover:bg-like/15"
        )}
        aria-label={
          property.reaction === "like" ? m.aria_unlike() : m.aria_like()
        }
        onClick={() =>
          property.reaction === "like"
            ? reactions.remove("like")
            : reactions.like()
        }
      >
        <Heart
          className={cn(
            "size-4",
            property.reaction === "like" && "fill-current"
          )}
        />
        {property.reaction === "like" ? m.reaction_unlike() : m.reaction_like()}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={reactions.isPending}
        className={cn(
          property.reaction === "dislike" &&
            "border-dislike bg-dislike/10 text-dislike hover:bg-dislike/15"
        )}
        aria-label={
          property.reaction === "dislike"
            ? m.aria_remove_dislike()
            : m.aria_dislike()
        }
        onClick={() =>
          property.reaction === "dislike"
            ? reactions.remove("dislike")
            : reactions.dislike()
        }
      >
        <ThumbsDown className="size-4" />
        {property.reaction === "dislike"
          ? m.reaction_remove_dislike()
          : m.reaction_dislike()}
      </Button>
      {property.reaction === "like" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={reactions.isPending}
          className={cn(
            property.archived &&
              "border-amber-600 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          )}
          aria-label={property.archived ? m.aria_unarchive() : m.aria_archive()}
          onClick={() => reactions.toggleArchive()}
        >
          <Archive className="size-4" />
          {property.archived ? m.reaction_unarchive() : m.reaction_archive()}
        </Button>
      ) : null}
    </>
  );
}
