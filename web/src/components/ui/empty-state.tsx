import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; to: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center",
        className
      )}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link to={action.to} className={cn(buttonVariants(), "mt-4")}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
