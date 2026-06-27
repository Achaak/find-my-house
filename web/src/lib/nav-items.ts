import {
  BarChart3,
  CircleHelp,
  Compass,
  Heart,
  Home,
  Search,
  Settings,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";
import * as m from "@/paraglide/messages.js";

export type NavItem = {
  to: string;
  label: () => string;
  icon: LucideIcon;
};

export const primaryNavItems: NavItem[] = [
  { to: "/", label: () => m.nav_home(), icon: Home },
  { to: "/listings", label: () => m.nav_listings(), icon: Search },
  { to: "/browse", label: () => m.nav_browse(), icon: Compass },
  { to: "/favorites", label: () => m.nav_favorites(), icon: Heart },
];

export const secondaryNavItems: NavItem[] = [
  { to: "/dislikes", label: () => m.nav_dislikes(), icon: ThumbsDown },
  { to: "/stats", label: () => m.nav_stats(), icon: BarChart3 },
  { to: "/help", label: () => m.nav_help(), icon: CircleHelp },
];

export function adminNavItem(isAdmin?: boolean): NavItem | null {
  if (!isAdmin) return null;
  return { to: "/admin", label: () => m.nav_admin(), icon: Settings };
}

export function secondaryNavPaths(isAdmin?: boolean): string[] {
  return [
    ...secondaryNavItems.map((item) => item.to),
    ...(isAdmin ? ["/admin"] : []),
  ];
}

export function navItemActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/listings") {
    return pathname.startsWith("/listings");
  }
  return pathname.startsWith(to);
}
