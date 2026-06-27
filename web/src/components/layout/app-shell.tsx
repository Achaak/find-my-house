import { Link, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { AppMenu } from "@/components/layout/app-menu";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { NavMoreMenu } from "@/components/layout/nav-more-menu";
import type { ApiUser } from "@find-my-house/api-types";
import { isImmersiveRoute } from "@/lib/layout-routes";
import { navItemActive, primaryNavItems } from "@/lib/nav-items";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

function NavLink({
  to,
  label,
  pathname,
}: {
  to: string;
  label: string;
  pathname: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
        navItemActive(pathname, to) && "bg-accent text-accent-foreground"
      )}
    >
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
  const immersive = isImmersiveRoute(pathname);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:gap-4">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold"
            aria-label={m.nav_home()}
          >
            <Home className="size-5 text-primary" />
            <span className="hidden sm:inline">{m.app_name()}</span>
          </Link>
          <nav
            className="hidden flex-1 items-center gap-0.5 lg:flex"
            aria-label={m.nav_main()}
          >
            {primaryNavItems.map(({ to, label }) => (
              <NavLink key={to} to={to} label={label()} pathname={pathname} />
            ))}
            <NavMoreMenu pathname={pathname} isAdmin={user?.isAdmin} />
          </nav>
          <div className="ml-auto">
            <AppMenu user={user} version={version} commit={commit} />
          </div>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto max-w-6xl px-4 py-6",
          !immersive && "page-with-tab-bar lg:pb-6",
          immersive && "page-immersive lg:pb-6"
        )}
      >
        {children}
      </main>
      {!immersive ? <MobileTabBar isAdmin={user?.isAdmin} /> : null}
    </div>
  );
}
