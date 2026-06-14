import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CircleHelp,
  Compass,
  Heart,
  Home,
  Search,
  Settings,
  ThumbsDown,
} from "lucide-react";
import { NotificationWatcher } from "@/components/layout/notification-watcher";
import type { ApiUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/listings", label: "Listings", icon: Search },
  { to: "/browse", label: "Browse", icon: Compass },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/dislikes", label: "Dislikes", icon: ThumbsDown },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/help", label: "Help", icon: CircleHelp },
] as const;

function NavLink({
  to,
  label,
  icon: Icon,
  pathname,
  compact = false,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  pathname: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-md transition-colors hover:bg-accent",
        compact ? "shrink-0 gap-1 px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
        pathname.startsWith(to) &&
          (compact ? "bg-accent" : "bg-accent text-accent-foreground")
      )}
    >
      <Icon className={compact ? "size-3.5" : "size-4"} />
      {label}
    </Link>
  );
}

export function AppShell({
  user,
  version,
  commit,
  children,
}: {
  user?: ApiUser;
  version?: string;
  commit?: string;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const versionLabel = version
    ? commit
      ? `v${version} (${commit.slice(0, 7)})`
      : `v${version}`
    : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Home className="size-5 text-primary" />
            <span>Find My House</span>
          </Link>
          <nav
            className="hidden flex-1 items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                label={label}
                icon={icon}
                pathname={pathname}
              />
            ))}
            {user?.isAdmin ? (
              <NavLink
                to="/admin"
                label="Admin"
                icon={Settings}
                pathname={pathname}
              />
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <NotificationWatcher />
            {user ? user.username : "…"}
            {versionLabel ? ` · ${versionLabel}` : null}
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden"
          aria-label="Main navigation"
        >
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              label={label}
              icon={icon}
              pathname={pathname}
              compact
            />
          ))}
          {user?.isAdmin ? (
            <NavLink
              to="/admin"
              label="Admin"
              icon={Settings}
              pathname={pathname}
              compact
            />
          ) : null}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
