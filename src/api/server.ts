import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { webConfig } from "../config/web.js";
import { createApiApp } from "./app.js";
import type { ApiContext } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("api:server");

export function startWebServer(ctx: ApiContext): void {
  if (!webConfig.web.enabled) {
    log.info("Web UI disabled (WEB_ENABLED=false)");
    return;
  }

  const app = createApiApp(ctx);
  const webDist = join(process.cwd(), "web", "dist");

  if (existsSync(webDist)) {
    app.use("/assets/*", serveStatic({ root: webDist }));
    app.get(
      "/favicon.svg",
      serveStatic({ path: "favicon.svg", root: webDist })
    );
    app.get("*", async (c, next) => {
      if (c.req.path.startsWith("/api")) {
        return next();
      }
      return serveStatic({ path: "index.html", root: webDist })(c, next);
    });
  } else {
    log.warn(`Web build not found at ${webDist} — API only`);
  }

  serve(
    {
      fetch: app.fetch,
      hostname: webConfig.web.host,
      port: webConfig.web.port,
    },
    (info) => {
      log.info(
        `Web server listening on http://${info.address}:${String(info.port)}`
      );
    }
  );
}
