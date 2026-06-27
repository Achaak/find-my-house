import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "default",
  children,
  ...props
}: ComponentProps<"div"> & {
  variant?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variant === "destructive"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-card text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
