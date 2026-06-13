import "./env.js";
import { z } from "zod";

function resolveHomeAssistantUrl(explicitUrl?: string): string {
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  if (process.env.SUPERVISOR_TOKEN) {
    return "http://supervisor/core";
  }

  return "http://127.0.0.1:8123";
}

const webEnvSchema = z
  .object({
    WEB_ENABLED: z.preprocess((value) => value !== "false", z.boolean()),
    WEB_PORT: z.coerce.number().int().positive().default(8099),
    WEB_HOST: z.string().min(1).default("0.0.0.0"),
    HOME_ASSISTANT_URL: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    }, z.url().optional()),
    WEB_ADMIN_USERS: z.string().optional(),
    WEB_AUTH_DISABLED: z.preprocess((value) => value === "true", z.boolean()),
    WEB_DEV_USER: z.string().min(1).default("dev"),
  })
  .transform((env) => ({
    web: {
      enabled: env.WEB_ENABLED,
      port: env.WEB_PORT,
      host: env.WEB_HOST,
      homeAssistantUrl: resolveHomeAssistantUrl(env.HOME_ASSISTANT_URL),
      adminUsers: env.WEB_ADMIN_USERS
        ? env.WEB_ADMIN_USERS.split(",")
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
        : [],
      authDisabled: env.WEB_AUTH_DISABLED,
      devUser: env.WEB_DEV_USER,
    },
  }));

export type WebConfig = z.infer<typeof webEnvSchema>;

export function parseWebConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = webEnvSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid web configuration: ${details}`);
  }
  return result.data;
}

export const webConfig = parseWebConfig();
