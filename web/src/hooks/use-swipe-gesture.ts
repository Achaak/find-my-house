import { useRef, useState } from "react";

export type SwipeDirection = "left" | "right" | "up";

const SWIPE_THRESHOLD = 80;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useSwipeGesture({
  onSwipe,
  disabled = false,
}: {
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const reducedMotion = prefersReducedMotion();

  const reset = () => {
    start.current = null;
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!start.current || disabled) return;
    setOffset({
      x: event.clientX - start.current.x,
      y: event.clientY - start.current.y,
    });
  };

  const onPointerUp = () => {
    if (!start.current || disabled) {
      reset();
      return;
    }

    const { x, y } = offset;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absY > absX && y < -SWIPE_THRESHOLD) {
      onSwipe("up");
    } else if (absX >= absY && x > SWIPE_THRESHOLD) {
      onSwipe("right");
    } else if (absX >= absY && x < -SWIPE_THRESHOLD) {
      onSwipe("left");
    }

    reset();
  };

  const hint: "like" | "dislike" | "pass" | null =
    offset.x > 40
      ? "like"
      : offset.x < -40
        ? "dislike"
        : offset.y < -40
          ? "pass"
          : null;

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
    },
    style:
      dragging && !reducedMotion
        ? {
            transform: `translate(${String(offset.x)}px, ${String(offset.y)}px) rotate(${String(offset.x * 0.04)}deg)`,
            transition: dragging ? "none" : "transform 200ms ease",
          }
        : undefined,
    hint,
    dragging,
  };
}
