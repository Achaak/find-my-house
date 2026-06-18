const DEFAULT_NOTIFY_SERVICE = "persistent_notification.create";

export function parseNotifyServices(raw: string): string[] {
  const services = raw
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);

  return services.length > 0 ? services : [DEFAULT_NOTIFY_SERVICE];
}
