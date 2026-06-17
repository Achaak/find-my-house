import { Bell, BellOff, Check, ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import type { ApiUser } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";
import { getLocale, locales, setLocale } from "@/paraglide/runtime.js";
import type { Locale } from "@/paraglide/runtime.js";

const localeLabels: Record<Locale, () => string> = {
  fr: () => m.locale_fr(),
  en: () => m.locale_en(),
};

export function AppMenu({
  user,
  version,
  commit,
}: {
  user?: ApiUser;
  version?: string;
  commit?: string;
}) {
  const currentLocale = getLocale();
  const notifications = useBrowserNotifications();

  const versionLabel = version
    ? commit
      ? `v${version} (${commit.slice(0, 7)})`
      : `v${version}`
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-40 gap-1.5 px-2"
            aria-label={m.app_menu()}
          />
        }
      >
        <User className="size-4 shrink-0" />
        <span className="truncate">{user ? user.username : "…"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {user ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate font-medium text-foreground">
                {user.username}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}

        {notifications.supported ? (
          <DropdownMenuItem
            className="whitespace-nowrap"
            onClick={notifications.toggle}
            disabled={notifications.isPending}
          >
            {notifications.enabled ? (
              <Bell className="size-4" />
            ) : (
              <BellOff className="size-4" />
            )}
            {notifications.enabled
              ? m.nav_notifications_disable()
              : m.nav_notifications_enable()}
          </DropdownMenuItem>
        ) : null}

        {notifications.supported ? <DropdownMenuSeparator /> : null}

        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.locale_switch()}</DropdownMenuLabel>
          {locales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              onClick={() => {
                if (locale !== currentLocale) setLocale(locale);
              }}
            >
              {localeLabels[locale]()}
              {locale === currentLocale ? (
                <Check className="ml-auto size-3.5" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        {versionLabel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {versionLabel}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
