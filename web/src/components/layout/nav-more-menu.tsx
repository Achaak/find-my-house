import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CircleHelp,
  Ellipsis,
  Settings,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const secondaryNavItems = [
  { to: "/dislikes", label: () => m.nav_dislikes(), icon: ThumbsDown },
  { to: "/stats", label: () => m.nav_stats(), icon: BarChart3 },
  { to: "/help", label: () => m.nav_help(), icon: CircleHelp },
] as const;

const secondaryPaths = secondaryNavItems.map((item) => item.to);

export function NavMoreMenu({
  pathname,
  isAdmin,
  compact = false,
}: {
  pathname: string;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const isActive =
    secondaryPaths.some((path) => pathname.startsWith(path)) ||
    (isAdmin && pathname.startsWith("/admin"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            className={cn(
              compact
                ? "shrink-0 gap-1 px-2.5 py-1.5 text-xs"
                : "px-3 py-2 text-sm",
              isActive && "bg-accent text-accent-foreground"
            )}
            aria-label={m.nav_more()}
          />
        }
      >
        <Ellipsis className={compact ? "size-3.5" : "size-4"} />
        <span>{m.nav_more()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {secondaryNavItems.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem
            key={to}
            render={<Link to={to} />}
            nativeButton={false}
            className={cn(
              pathname.startsWith(to) && "bg-accent text-accent-foreground"
            )}
          >
            <Icon />
            {label()}
          </DropdownMenuItem>
        ))}
        {isAdmin ? (
          <DropdownMenuItem
            render={<Link to="/admin" />}
            nativeButton={false}
            className={cn(
              pathname.startsWith("/admin") &&
                "bg-accent text-accent-foreground"
            )}
          >
            <Settings />
            {m.nav_admin()}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
