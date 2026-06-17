import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Heart, Home, Search } from "lucide-react";
import { AppMenu } from "@/components/layout/app-menu";
import { NavMoreMenu } from "@/components/layout/nav-more-menu";
import type { ApiUser } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { to: "/listings", label: () => m.nav_listings(), icon: Search },
  { to: "/browse", label: () => m.nav_browse(), icon: Compass },
  { to: "/favorites", label: () => m.nav_favorites(), icon: Heart },
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

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Home className="size-5 text-primary" />
            <span>{m.app_name()}</span>
          </Link>
          <nav
            className="hidden flex-1 items-center gap-1 md:flex"
            aria-label={m.nav_main()}
          >
            {primaryNavItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                label={label()}
                icon={icon}
                pathname={pathname}
              />
            ))}
            <NavMoreMenu pathname={pathname} isAdmin={user?.isAdmin} />
          </nav>
          <div className="ml-auto">
            <AppMenu user={user} version={version} commit={commit} />
          </div>
        </div>
        <nav
          className="flex gap-1 border-t px-4 py-2 md:hidden"
          aria-label={m.nav_main()}
        >
          {primaryNavItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              label={label()}
              icon={icon}
              pathname={pathname}
              compact
            />
          ))}
          <NavMoreMenu pathname={pathname} isAdmin={user?.isAdmin} compact />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
