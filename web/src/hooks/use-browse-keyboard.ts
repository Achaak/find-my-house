import { useEffect } from "react";

export function useBrowseKeyboard({
  enabled,
  onLike,
  onDislike,
  onPass,
}: {
  enabled: boolean;
  onLike: () => void;
  onDislike: () => void;
  onPass: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onLike();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onDislike();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        onPass();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onLike, onDislike, onPass]);
}
