import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { webConfig } from "../config/web.js";
import { createApiApp } from "./app.js";
import { getIngressPath, prepareIndexHtml } from "./ingressHtml.js";
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
    const indexPath = join(webDist, "index.html");
    const indexTemplate = existsSync(indexPath)
      ? readFileSync(indexPath, "utf8")
      : null;

    app.use("/assets/*", serveStatic({ root: webDist }));
    app.get(
      "/favicon.svg",
      serveStatic({ path: "favicon.svg", root: webDist })
    );
    app.get("*", async (c, next) => {
      if (c.req.path.startsWith("/api")) {
        return next();
      }
      if (!indexTemplate) {
        return serveStatic({ path: "index.html", root: webDist })(c, next);
      }

      const html = prepareIndexHtml(indexTemplate, getIngressPath(c.req.raw));

      c.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return c.html(html);
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
