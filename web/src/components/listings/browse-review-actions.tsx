import { Heart, RotateCcw, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function BrowseReviewActions({
  disabled,
  onLike,
  onDislike,
  onPass,
  className,
}: {
  disabled: boolean;
  onLike: () => void;
  onDislike: () => void;
  onPass: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={disabled}
        className="size-14 rounded-full border-dislike text-dislike hover:bg-dislike/10"
        aria-label={m.browse_dislike_next()}
        onClick={onDislike}
      >
        <ThumbsDown className="size-6" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={disabled}
        className="size-12 rounded-full"
        aria-label={m.browse_pass_next()}
        onClick={onPass}
      >
        <RotateCcw className="size-5" />
      </Button>
      <Button
        type="button"
        size="icon"
        disabled={disabled}
        className="size-14 rounded-full bg-like text-like-foreground hover:bg-like/90"
        aria-label={m.browse_like_next()}
        onClick={onLike}
      >
        <Heart className="size-6 fill-current" />
      </Button>
    </div>
  );
}

export function DetailReactionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:rounded-xl md:border md:bg-card md:shadow-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap gap-2">{children}</div>
    </div>
  );
}
