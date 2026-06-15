const INGRESS_HEADER = "x-ingress-path";

export function getIngressPath(request: Request): string | null {
  const path = request.headers.get(INGRESS_HEADER);
  if (!path || path === "/") {
    return null;
  }
  return path.replace(/\/$/, "");
}

export function prepareIndexHtml(
  template: string,
  ingressPath: string | null
): string {
  const baseHref = ingressPath ? `${ingressPath}/` : "/";
  const bootstrap = ingressPath
    ? `<script>window.__INGRESS_PATH__=${JSON.stringify(ingressPath)};</script>`
    : null;
  const injection = bootstrap
    ? `<base href="${baseHref}">\n    ${bootstrap}`
    : `<base href="${baseHref}">`;

  let html = template;

  if (ingressPath) {
    // Safety net for older builds that still emit absolute /assets/ paths.
    html = html.replace(/(\s(?:src|href)=["'])\/(?!\/)/g, `$1${ingressPath}/`);
  }

  if (/<base\s/i.test(html)) {
    html = html.replace(/<base[^>]*>/i, `<base href="${baseHref}">`);
    if (bootstrap) {
      html = html.replace(/<head>/i, `<head>\n    ${bootstrap}`);
    }
  } else {
    html = html.replace(/<head>/i, `<head>\n    ${injection}`);
  }

  return html;
}

export { INGRESS_HEADER };
