import vm from "node:vm";

function extractJsonParseArg(html: string, varName: string): string | null {
  const marker = `window["${varName}"]=JSON.parse("`;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  let i = start + marker.length;
  let arg = "";

  while (i < html.length) {
    const ch = html[i];
    if (ch === "\\") {
      arg += html.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '"') break;
    arg += ch;
    i++;
  }

  return arg;
}

export function parseEmbeddedWindowJson(
  varName: string,
  html: string
): unknown {
  const arg = extractJsonParseArg(html, varName);
  if (!arg) return null;

  try {
    const jsonText = vm.runInNewContext(`"${arg}"`) as string;
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}
