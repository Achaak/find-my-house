import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages.js";

export function BrowseUndoToast({
  propertyId,
  undoUntil,
  onUndo,
  onDismiss,
}: {
  propertyId: number;
  undoUntil: string;
  onUndo: (propertyId: number) => void;
  onDismiss: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(undoUntil).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((new Date(undoUntil).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(left);
      if (left <= 0) onDismiss();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [undoUntil, onDismiss]);

  if (secondsLeft <= 0) return null;

  return (
    <div
      role="status"
      className="mx-4 mb-2 flex max-w-md items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur md:mx-auto md:max-w-none lg:mx-0"
    >
      <p className="text-sm">
        {m.browse_undo_message({ seconds: secondsLeft })}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onUndo(propertyId)}
      >
        {m.browse_undo_action()}
      </Button>
    </div>
  );
}
