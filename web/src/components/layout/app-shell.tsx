import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Compass,
  Heart,
  Home,
  Search,
  Settings,
  ThumbsDown,
} from "lucide-react";
import type { ApiUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/listings", label: "Listings", icon: Search },
  { to: "/browse", label: "Browse", icon: Compass },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/dislikes", label: "Dislikes", icon: ThumbsDown },
  { to: "/stats", label: "Stats", icon: BarChart3 },
] as const;

export function AppShell({
  user,
  version,
  children,
}: {
  user?: ApiUser;
  version?: string;
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
            <span>Find My House</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  pathname.startsWith(to) && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            {user?.isAdmin ? (
              <Link
                to="/admin"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  pathname.startsWith("/admin") &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <Settings className="size-4" />
                Admin
              </Link>
            ) : null}
          </nav>
          <div className="ml-auto text-xs text-muted-foreground">
            {user ? user.username : "…"}
            {version ? ` · v${version}` : null}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
                pathname.startsWith(to) && "bg-accent"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
