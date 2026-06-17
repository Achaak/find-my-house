import type { PrismaClient } from "../generated/prisma/client.js";

export class NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getEnabled(userId: string): Promise<boolean> {
    const row = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });
    return row?.enabled ?? true;
  }

  async setEnabled(userId: string, enabled: boolean): Promise<boolean> {
    const row = await this.prisma.userNotificationPreference.upsert({
      where: { userId },
      create: { userId, enabled },
      update: { enabled },
    });
    return row.enabled;
  }

  /** Send HA alerts when no preference rows exist, or at least one user opted in. */
  async shouldSendHouseholdNotifications(): Promise<boolean> {
    const [enabledCount, disabledCount] = await Promise.all([
      this.prisma.userNotificationPreference.count({
        where: { enabled: true },
      }),
      this.prisma.userNotificationPreference.count({
        where: { enabled: false },
      }),
    ]);

    if (enabledCount > 0) return true;
    if (disabledCount > 0) return false;
    return true;
  }
}
