import { Link, useRouterState } from "@tanstack/react-router";
import { NavMoreMenu } from "@/components/layout/nav-more-menu";
import { navItemActive, primaryNavItems } from "@/lib/nav-items";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

export function MobileTabBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden"
      aria-label={m.nav_main()}
    >
      <div className="mx-auto flex max-w-6xl items-stretch px-1 pb-[env(safe-area-inset-bottom)] pt-1">
        {primaryNavItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
              navItemActive(pathname, to)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{label()}</span>
          </Link>
        ))}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <NavMoreMenu pathname={pathname} isAdmin={isAdmin} tabStyle />
        </div>
      </div>
    </nav>
  );
}
