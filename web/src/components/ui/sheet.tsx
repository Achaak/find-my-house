import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const closeButton = panel?.querySelector<HTMLElement>(FOCUSABLE);
    closeButton?.focus();

    return () => {
      document.body.style.overflow = previous;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables.at(-1)!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={m.common_close()}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? m.common_close()}
        className={cn(
          "relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl border bg-card shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          {title ? (
            <h2 id="sheet-title" className="font-semibold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label={m.common_close()}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
