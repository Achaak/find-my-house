import { Link } from "@tanstack/react-router";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  adminNavItem,
  navItemActive,
  secondaryNavItems,
  secondaryNavPaths,
} from "@/lib/nav-items";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

export function NavMoreMenu({
  pathname,
  isAdmin,
  tabStyle = false,
}: {
  pathname: string;
  isAdmin?: boolean;
  tabStyle?: boolean;
}) {
  const adminItem = adminNavItem(isAdmin);
  const isActive = secondaryNavPaths(isAdmin).some((path) =>
    pathname.startsWith(path)
  );
  const AdminIcon = adminItem?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={tabStyle ? "default" : "sm"}
            className={cn(
              tabStyle
                ? "h-auto w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium"
                : "gap-1 px-2.5 py-1.5 text-xs",
              isActive &&
                (tabStyle ? "text-primary" : "bg-accent text-accent-foreground")
            )}
            aria-label={m.nav_more()}
          />
        }
      >
        <Ellipsis className={tabStyle ? "size-5" : "size-3.5"} />
        {tabStyle ? <span>{m.nav_more()}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={tabStyle ? "end" : "start"}>
        {secondaryNavItems.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem
            key={to}
            render={<Link to={to} />}
            nativeButton={false}
            className={cn(
              navItemActive(pathname, to) && "bg-accent text-accent-foreground"
            )}
          >
            <Icon />
            {label()}
          </DropdownMenuItem>
        ))}
        {adminItem && AdminIcon ? (
          <DropdownMenuItem
            render={<Link to={adminItem.to} />}
            nativeButton={false}
            className={cn(
              navItemActive(pathname, adminItem.to) &&
                "bg-accent text-accent-foreground"
            )}
          >
            <AdminIcon />
            {adminItem.label()}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
