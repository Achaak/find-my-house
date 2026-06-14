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
  if (!ingressPath) {
    return template;
  }

  const baseHref = `${ingressPath}/`;
  const bootstrap = `<script>window.__INGRESS_PATH__=${JSON.stringify(ingressPath)};</script>`;
  const injection = `<base href="${baseHref}">\n    ${bootstrap}`;

  let html = template;

  // Safety net for older builds that still emit absolute /assets/ paths.
  html = html.replace(/(\s(?:src|href)=["'])\/(?!\/)/g, `$1${ingressPath}/`);

  if (/<base\s/i.test(html)) {
    html = html.replace(/<base[^>]*>/i, `<base href="${baseHref}">`);
    html = html.replace(/<head>/i, `<head>\n    ${bootstrap}`);
  } else {
    html = html.replace(/<head>/i, `<head>\n    ${injection}`);
  }

  return html;
}

export { INGRESS_HEADER };
