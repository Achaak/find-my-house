import { describe, expect, it } from "vitest";
import { getIngressPath, prepareIndexHtml } from "./ingressHtml.js";

const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" crossorigin src="./assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe("getIngressPath", () => {
  it("reads X-Ingress-Path from the request", () => {
    const request = new Request("http://localhost/", {
      headers: { "X-Ingress-Path": "/api/hassio_ingress/token123" },
    });

    expect(getIngressPath(request)).toBe("/api/hassio_ingress/token123");
  });

  it("returns null when the header is missing", () => {
    expect(getIngressPath(new Request("http://localhost/"))).toBeNull();
  });
});

describe("prepareIndexHtml", () => {
  it("injects base href and rewrites absolute asset paths", () => {
    const html = prepareIndexHtml(template, "/api/hassio_ingress/token123");

    expect(html).toContain('<base href="/api/hassio_ingress/token123/">');
    expect(html).toContain(
      'window.__INGRESS_PATH__="/api/hassio_ingress/token123"'
    );
    expect(html).toContain(
      'href="/api/hassio_ingress/token123/assets/index.css"'
    );
  });

  it("returns the template unchanged outside ingress", () => {
    expect(prepareIndexHtml(template, null)).toBe(template);
  });
});
