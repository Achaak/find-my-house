export function extractNextData(html: string): unknown {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(
    html
  );
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}
