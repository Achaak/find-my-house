import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";

export function SwipeOverlay({
  hint,
}: {
  hint: "like" | "dislike" | "pass" | null;
}) {
  if (!hint) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-xl opacity-80",
        hint === "like" && "bg-like/20 ring-2 ring-like",
        hint === "dislike" && "bg-dislike/20 ring-2 ring-dislike",
        hint === "pass" && "bg-pass/20 ring-2 ring-pass"
      )}
    />
  );
}

export function SwipeCardShell({
  children,
  className,
  style,
  bind,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  bind: ReturnType<typeof useSwipeGesture>["bind"];
}) {
  return (
    <div
      className={cn("relative touch-none select-none", className)}
      style={style}
      {...bind}
    >
      {children}
    </div>
  );
}
