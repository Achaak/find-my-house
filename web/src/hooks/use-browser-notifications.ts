import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, queryKeys } from "@/lib/api";
import { formatPriceDrop, hasPriceDrop } from "@/lib/price-drop";
import * as m from "@/paraglide/messages.js";

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

export function useBrowserNotifications() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(ENABLED_KEY) === "true"
  );
  const [since, setSince] = useState(readSince);
  const lastHandledRef = useRef<number | null>(null);

  const digestQuery = useQuery({
    queryKey: queryKeys.notifications(since),
    queryFn: () => api.notificationsDigest(since),
    enabled: supported && enabled,
    refetchInterval: 5 * 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!supported) {
        throw new Error(m.notifications_unsupported());
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(m.notifications_denied());
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
        ? m.notifications_body_price_drop({ city: property.city, drop })
        : m.notifications_body_new({ city: property.city });
      new Notification(property.title, { body, tag: `listing-${property.id}` });
      notified.add(property.id);
    }

    writeNotifiedIds(notified);
    const nextSince = new Date().toISOString();
    writeSince(nextSince);
    setSince(nextSince);
  }, [digestQuery.data, digestQuery.dataUpdatedAt, enabled]);

  function toggle() {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, "false");
      setEnabled(false);
      return;
    }
    enableMutation.mutate();
  }

  return {
    supported,
    enabled,
    isPending: enableMutation.isPending,
    toggle,
  };
}
