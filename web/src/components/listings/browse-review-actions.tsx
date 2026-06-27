import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages.js";

export function BrowseReviewActions({
  disabled,
  onLike,
  onDislike,
  onPass,
}: {
  disabled: boolean;
  onLike: () => void;
  onDislike: () => void;
  onPass: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex gap-2">
        <Button type="button" disabled={disabled} onClick={onLike}>
          {disabled ? m.common_saving() : m.browse_like_next()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onDislike}
        >
          {disabled ? m.common_saving() : m.browse_dislike_next()}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={onPass}
      >
        {disabled ? m.common_saving() : m.browse_pass_next()}
      </Button>
    </div>
  );
}
