import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { formatPriceDrop, hasPriceDrop } from "@/lib/price-drop";

const STORAGE_KEY = "find-my-house.notifications.since";
const ENABLED_KEY = "find-my-house.notifications.enabled";
const NOTIFIED_KEY = "find-my-house.notifications.notified";

function readSince(): string {
  return localStorage.getItem(STORAGE_KEY) ?? new Date().toISOString();
}

function writeSince(value: string): void {
  localStorage.setItem(STORAGE_KEY, value);
}

function readNotifiedIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function writeNotifiedIds(ids: Set<number>): void {
  sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
}

export function NotificationWatcher() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(ENABLED_KEY) === "true"
  );
  const [since, setSince] = useState(readSince);
  const lastHandledRef = useRef<number | null>(null);

  const digestQuery = useQuery({
    queryKey: queryKeys.notifications(since),
    queryFn: () => api.notificationsDigest(since),
    enabled,
    refetchInterval: 5 * 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!("Notification" in window)) {
        throw new Error("Browser notifications are not supported.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission denied.");
      }
      localStorage.setItem(ENABLED_KEY, "true");
      setEnabled(true);
    },
  });

  useEffect(() => {
    if (!enabled || !digestQuery.data) return;
    if (lastHandledRef.current === digestQuery.dataUpdatedAt) return;
    lastHandledRef.current = digestQuery.dataUpdatedAt;

    const notified = readNotifiedIds();
    const candidates = [
      ...digestQuery.data.newListings,
      ...digestQuery.data.priceDrops.filter(hasPriceDrop),
    ].filter((property) => !notified.has(property.id));

    for (const property of candidates.slice(0, 5)) {
      const drop = formatPriceDrop(property);
      const body = drop
        ? `${property.city} · ${drop}`
        : `${property.city} · new listing`;
      new Notification(property.title, { body, tag: `listing-${property.id}` });
      notified.add(property.id);
    }

    writeNotifiedIds(notified);
    const nextSince = new Date().toISOString();
    writeSince(nextSince);
    setSince(nextSince);
  }, [digestQuery.data, digestQuery.dataUpdatedAt, enabled]);

  if (!("Notification" in window)) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="hidden md:inline-flex"
      disabled={enableMutation.isPending}
      onClick={() => {
        if (enabled) {
          localStorage.setItem(ENABLED_KEY, "false");
          setEnabled(false);
          return;
        }
        enableMutation.mutate();
      }}
      aria-label={enabled ? "Disable notifications" : "Enable notifications"}
    >
      {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </Button>
  );
}
