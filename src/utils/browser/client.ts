import { launchPersistentContext } from "cloakbrowser";
import type { BrowserContext } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { browserConfig } from "../../config/browser.js";
import { createLogger } from "../logger.js";
import {
  backupAndRecreateProfile,
  clearStaleProfileLocks,
  isBrowserProfileInUseError,
  killBrowsersUsingProfile,
  PROFILE_LOCK_MAX_ATTEMPTS,
  PROFILE_LOCK_RETRY_BASE_MS,
  sleep,
} from "./profileLock.js";

const log = createLogger("browser");

function resolveDefaultProfileDir(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl?.startsWith("file:/data/") || dbUrl?.startsWith("file:///data/")) {
    return "/data/cloakbrowser-profile";
  }
  return join(process.cwd(), "data", "cloakbrowser-profile");
}

export class BrowserHttpError extends Error {
  readonly statusCode: number;
  readonly statusText: string;

  constructor(statusCode: number, statusText: string) {
    super(`HTTP ${String(statusCode)} ${statusText}`.trim());
    this.name = "BrowserHttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

export class BrowserProfileInUseError extends Error {
  constructor(profileDir: string) {
    super(
      `CloakBrowser: profile already in use (${profileDir}). ` +
        "Close the open Chromium window, or run with CLOAKBROWSER_HEADLESS=true."
    );
    this.name = "BrowserProfileInUseError";
  }
}

const profileDir =
  browserConfig.browser.profileDir ?? resolveDefaultProfileDir();

const headless = browserConfig.browser.headless;
const humanize = browserConfig.browser.humanize;
const proxy = browserConfig.browser.proxy;
const geoip = browserConfig.browser.geoip;

function isHomeAssistantRuntime(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return (
    dbUrl?.startsWith("file:/data/") === true ||
    dbUrl?.startsWith("file:///data/") === true
  );
}

function buildLaunchArgs(): string[] {
  const args: string[] = [];
  if (isHomeAssistantRuntime()) {
    args.push("--no-sandbox", "--disable-dev-shm-usage");
  }
  const fingerprint = browserConfig.browser.fingerprint;
  if (fingerprint && /^\d+$/.test(fingerprint)) {
    args.push(`--fingerprint=${fingerprint}`);
  }
  const storageQuota = browserConfig.browser.storageQuota;
  if (storageQuota && /^\d+$/.test(storageQuota)) {
    args.push(`--fingerprint-storage-quota=${storageQuota}`);
  }
  return args;
}

let contextPromise: Promise<BrowserContext> | null = null;
let launchQueue: Promise<void> = Promise.resolve();
let initGeneration = 0;
const warmedUpOrigins = new Set<string>();

export type BrowserReadinessStatus = "idle" | "starting" | "ready" | "error";

let browserReadinessStatus: BrowserReadinessStatus = "idle";
let browserReadinessError: string | undefined;
let browserWarmUpPromise: Promise<void> | null = null;

async function warmUpBrowser(): Promise<void> {
  browserReadinessStatus = "starting";
  browserReadinessError = undefined;
  try {
    await getBrowserContextInternal();
    browserReadinessStatus = "ready";
  } catch (error) {
    browserReadinessStatus = "error";
    browserReadinessError =
      error instanceof Error ? error.message : String(error);
    throw error;
  }
}

function getBrowserWarmUpPromise(): Promise<void> {
  browserWarmUpPromise ??= warmUpBrowser().catch((error: unknown) => {
    browserWarmUpPromise = null;
    throw error;
  });
  return browserWarmUpPromise;
}

/** Kick off browser launch at startup without blocking the rest of the app. */
export function startBrowserWarmUp(): void {
  void getBrowserWarmUpPromise().catch((error: unknown) => {
    log.warn(
      "Browser warm-up failed (will retry on next scrape):",
      error instanceof Error ? error.message : error
    );
  });
}

export function getBrowserReadiness(): {
  browser: BrowserReadinessStatus;
  error?: string;
} {
  return browserReadinessError
    ? { browser: browserReadinessStatus, error: browserReadinessError }
    : { browser: browserReadinessStatus };
}

mkdirSync(profileDir, { recursive: true });
clearStaleProfileLocks(profileDir);

async function withLaunchLock<T>(operation: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const previous = launchQueue;
  launchQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function launchBrowserContext(
  useHeadless = headless
): Promise<BrowserContext> {
  if (browserConfig.browser.resetProfile) {
    const backupDir = backupAndRecreateProfile(profileDir);
    if (backupDir) {
      log.warn(`CloakBrowser profile reset (backup: ${backupDir})`);
    }
  } else {
    mkdirSync(profileDir, { recursive: true });
    clearStaleProfileLocks(profileDir);
  }

  const launchArgs = buildLaunchArgs();
  return launchPersistentContext({
    userDataDir: profileDir,
    headless: useHeadless,
    locale: "fr-FR",
    humanize,
    ...(proxy ? { proxy, geoip } : {}),
    ...(launchArgs.length > 0 ? { args: launchArgs } : {}),
  });
}

async function recoverBrowserContext(
  error: unknown,
  generation: number
): Promise<BrowserContext> {
  if (!headless && isBrowserProfileInUseError(error)) {
    log.warn(
      "CloakBrowser profile unavailable in headed mode — retrying headless."
    );
    try {
      return await launchBrowserContext(true);
    } catch (headlessError) {
      error = headlessError;
    }
  }

  if (!isBrowserProfileInUseError(error)) {
    throw error;
  }

  for (let attempt = 1; attempt <= PROFILE_LOCK_MAX_ATTEMPTS; attempt++) {
    if (generation !== initGeneration) {
      throw new Error("Browser initialization cancelled");
    }

    if (attempt > 1) {
      await sleep(attempt * PROFILE_LOCK_RETRY_BASE_MS);
      if (generation !== initGeneration) {
        throw new Error("Browser initialization cancelled");
      }
    }

    clearStaleProfileLocks(profileDir);

    if (attempt === PROFILE_LOCK_MAX_ATTEMPTS) {
      const backupDir = backupAndRecreateProfile(profileDir);
      log.warn(
        backupDir
          ? `CloakBrowser profile corrupted or locked — recreated (backup: ${backupDir})`
          : "CloakBrowser profile recreated"
      );
    }

    try {
      return await launchBrowserContext(true);
    } catch (retryError) {
      error = retryError;
      if (
        attempt < PROFILE_LOCK_MAX_ATTEMPTS &&
        isBrowserProfileInUseError(retryError)
      ) {
        log.warn(
          `CloakBrowser profile still locked (attempt ${String(attempt)}/${String(PROFILE_LOCK_MAX_ATTEMPTS)}) — retrying...`
        );
        continue;
      }
      throw retryError;
    }
  }

  throw error;
}

async function initBrowserContext(): Promise<BrowserContext> {
  const generation = initGeneration;
  return withLaunchLock(async () => {
    try {
      return await launchBrowserContext();
    } catch (error) {
      killBrowsersUsingProfile(profileDir);
      return recoverBrowserContext(error, generation);
    }
  });
}

async function getBrowserContextInternal(): Promise<BrowserContext> {
  contextPromise ??= initBrowserContext().catch((error: unknown) => {
    contextPromise = null;
    if (isBrowserProfileInUseError(error)) {
      throw new BrowserProfileInUseError(profileDir);
    }
    throw error;
  });

  return contextPromise;
}

async function getBrowserContext(): Promise<BrowserContext> {
  return getBrowserContextInternal();
}

/** Launch the shared browser before parallel scrapers start. */
export async function ensureBrowserReady(): Promise<void> {
  await getBrowserWarmUpPromise();
}

function buildUrl(url: string, searchParams?: Record<string, string>): string {
  if (!searchParams) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(searchParams)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

async function ensureOriginWarmedUp(
  warmUpUrl: string,
  timeoutMs = 30_000
): Promise<void> {
  const origin = new URL(warmUpUrl).origin;
  if (warmedUpOrigins.has(origin)) return;

  const context = await getBrowserContext();
  const page = await context.newPage();
  try {
    await page
      .goto(warmUpUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      })
      .catch(() => {
        /* warm-up is best-effort */
      });
    warmedUpOrigins.add(origin);
  } finally {
    await page.close();
  }
}

export type BrowserRequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  json?: unknown;
  body?: string;
  searchParams?: Record<string, string>;
  timeoutMs?: number;
  failOnStatusCode?: boolean;
  warmUpUrl?: string;
};

export type BrowserResponse = {
  status: number;
  statusText: string;
  body: string;
};

/** HTTP request via Playwright (shared cookies with CloakBrowser, no CORS). */
export async function browserRequest(
  url: string,
  options: BrowserRequestOptions = {}
): Promise<BrowserResponse> {
  const fullUrl = buildUrl(url, options.searchParams);
  const context = await getBrowserContext();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const method = options.method ?? "GET";

  if (options.warmUpUrl) {
    await ensureOriginWarmedUp(options.warmUpUrl, timeoutMs);
  }

  const common = {
    headers: options.headers,
    timeout: timeoutMs,
    failOnStatusCode: false,
  };

  const response =
    method === "POST"
      ? await context.request.post(fullUrl, {
          ...common,
          data: options.json ?? options.body,
        })
      : await context.request.get(fullUrl, common);

  const status = response.status();
  const body = await response.text();

  if (options.failOnStatusCode !== false && status >= 400) {
    throw new BrowserHttpError(status, response.statusText());
  }

  return { status, statusText: response.statusText(), body };
}

export async function browserRequestJson<T>(
  url: string,
  options: BrowserRequestOptions = {}
): Promise<T> {
  const response = await browserRequest(url, options);
  return JSON.parse(response.body) as T;
}

export type FetchPageHtmlOptions = {
  referer?: string;
  timeoutMs?: number;
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  /** Extra delay after navigation (client-side hydration, MFE loads). */
  settleMs?: number;
  /** Wait for a network response URL matching this pattern before reading HTML. */
  waitForResponseUrl?: RegExp | string;
};

export type BrowserPagePostJsonOptions = {
  warmUpOrigin?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type BrowserPageFetchOptions = {
  warmUpOrigin?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

/** GET via in-page fetch (browser cookies + CORS, not Node HTTP). */
export async function browserPageFetch(
  url: string,
  options: BrowserPageFetchOptions = {}
): Promise<{ status: number; body: string }> {
  const warmUpOrigin = options.warmUpOrigin ?? new URL(url).origin;
  await ensureOriginWarmedUp(warmUpOrigin, options.timeoutMs ?? 60_000);

  const context = await getBrowserContext();
  const page = await context.newPage();
  const timeoutMs = options.timeoutMs ?? 60_000;

  try {
    await page
      .goto(warmUpOrigin, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      })
      .catch(() => {
        /* warm-up is best-effort */
      });

    return await page.evaluate(
      async ({ requestUrl, headers }) => {
        const response = await fetch(requestUrl, { headers });
        return { status: response.status, body: await response.text() };
      },
      { requestUrl: url, headers: options.headers ?? {} }
    );
  } finally {
    await page.close();
  }
}

/** POST JSON via in-page fetch (browser cookies + CORS, not Node HTTP). */
export async function browserPagePostJson(
  url: string,
  body: unknown,
  options: BrowserPagePostJsonOptions = {}
): Promise<{ status: number; data: unknown }> {
  const warmUpOrigin = options.warmUpOrigin ?? new URL(url).origin;
  await ensureOriginWarmedUp(warmUpOrigin, options.timeoutMs ?? 60_000);

  const context = await getBrowserContext();
  const page = await context.newPage();
  const timeoutMs = options.timeoutMs ?? 60_000;

  try {
    await page
      .goto(warmUpOrigin, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      })
      .catch(() => {
        /* warm-up is best-effort */
      });

    const result = await page.evaluate(
      async ({ requestUrl, payload, headers }) => {
        const response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        return { status: response.status, text };
      },
      { requestUrl: url, payload: body, headers: options.headers ?? {} }
    );

    if (result.status >= 400) {
      throw new BrowserHttpError(result.status, result.text.slice(0, 120));
    }

    return { status: result.status, data: JSON.parse(result.text) as unknown };
  } finally {
    await page.close();
  }
}

export async function fetchPageHtml(
  url: string,
  options: FetchPageHtmlOptions = {}
): Promise<string> {
  const origin = new URL(url).origin;
  await ensureOriginWarmedUp(origin, options.timeoutMs ?? 60_000);

  const context = await getBrowserContext();
  const page = await context.newPage();
  const timeoutMs = options.timeoutMs ?? 60_000;

  try {
    // Reuse the warmed-up origin in the same tab before hitting search/detail URLs.
    if (new URL(url).pathname !== "/") {
      await page
        .goto(origin, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        })
        .catch(() => {
          /* warm-up is best-effort */
        });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }

    const response = await page.goto(url, {
      waitUntil: options.waitUntil ?? "domcontentloaded",
      timeout: timeoutMs,
      referer: options.referer ?? `${origin}/`,
    });

    if (!response) {
      throw new Error("Navigation failed: no response");
    }

    const status = response.status();
    if (status >= 400) {
      throw new BrowserHttpError(status, response.statusText());
    }

    if (options.waitForResponseUrl) {
      const pattern = options.waitForResponseUrl;
      await page
        .waitForResponse(
          (res) => {
            const responseUrl = res.url();
            return typeof pattern === "string"
              ? responseUrl.includes(pattern)
              : pattern.test(responseUrl);
          },
          { timeout: timeoutMs }
        )
        .catch(() => {
          /* best-effort — fall back to settle delay */
        });
    }

    if (options.settleMs && options.settleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.settleMs));
    }

    return await page.content();
  } finally {
    await page.close();
  }
}

export async function warmUpBrowserSession(url: string): Promise<void> {
  await ensureOriginWarmedUp(url);
}

/** Close the browser and recreate an empty profile (one-shot anti-bot recovery). */
export async function resetBrowserProfile(): Promise<string | null> {
  warmedUpOrigins.clear();

  if (contextPromise) {
    try {
      const context = await contextPromise;
      await context.close();
    } catch {
      /* ignore */
    }
    contextPromise = null;
  }

  const backupDir = backupAndRecreateProfile(profileDir);
  if (backupDir) {
    log.warn(`CloakBrowser profile reset after block (backup: ${backupDir})`);
  }

  return backupDir;
}

export function isRetryableBrowserFetchError(error: unknown): boolean {
  if (isBrowserAccessBlocked(error)) return true;
  return (
    error instanceof Error &&
    (error.message.includes("Navigation failed") ||
      error.message.includes("net::ERR"))
  );
}

export type InterceptPageJsonResponseOptions = {
  referer?: string;
  timeoutMs?: number;
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  settleMs?: number;
  responseUrlPattern?: RegExp | string;
};

/** Navigate to a page and capture a JSON API response triggered by client-side JS. */
export async function interceptPageJsonResponse(
  pageUrl: string,
  options: InterceptPageJsonResponseOptions = {}
): Promise<{ status: number; data: unknown } | null> {
  const origin = new URL(pageUrl).origin;
  await ensureOriginWarmedUp(origin, options.timeoutMs ?? 60_000);

  const context = await getBrowserContext();
  const page = await context.newPage();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pattern = options.responseUrlPattern ?? /serp-bff\/search/;

  let captured: { status: number; data: unknown } | null = null;

  page.on("response", async (response) => {
    const responseUrl = response.url();
    const matches =
      typeof pattern === "string"
        ? responseUrl.includes(pattern)
        : pattern.test(responseUrl);
    if (!matches || captured) return;

    try {
      const text = await response.text();
      captured = {
        status: response.status(),
        data: JSON.parse(text) as unknown,
      };
    } catch {
      /* ignore non-JSON responses */
    }
  });

  try {
    if (new URL(pageUrl).pathname !== "/") {
      await page
        .goto(origin, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        })
        .catch(() => {
          /* warm-up is best-effort */
        });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }

    const response = await page.goto(pageUrl, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: timeoutMs,
      referer: options.referer ?? `${origin}/`,
    });

    if (response && response.status() >= 400) {
      throw new BrowserHttpError(response.status(), response.statusText());
    }

    if (options.settleMs && options.settleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.settleMs));
    }

    return captured;
  } finally {
    await page.close();
  }
}

export function isBrowserAccessBlocked(
  error: unknown
): error is BrowserHttpError {
  return (
    error instanceof BrowserHttpError &&
    (error.statusCode === 403 || error.statusCode === 429)
  );
}

export async function clearBrowserCookiesForHost(
  hostname: string
): Promise<void> {
  const context = await getBrowserContext();
  const cookies = await context.cookies();
  const host = hostname.toLowerCase();

  for (const cookie of cookies) {
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    if (host === domain || host.endsWith(`.${domain}`)) {
      await context.clearCookies({
        domain: cookie.domain,
        name: cookie.name,
        path: cookie.path,
      });
    }
  }

  for (const origin of warmedUpOrigins) {
    try {
      if (new URL(origin).hostname.toLowerCase() === host) {
        warmedUpOrigins.delete(origin);
      }
    } catch {
      // ignore invalid origins
    }
  }
}

export async function closeBrowserContext(): Promise<void> {
  initGeneration++;
  warmedUpOrigins.clear();

  const pending = contextPromise;
  contextPromise = null;

  if (pending) {
    try {
      const context = await pending;
      await context.close();
    } catch (error) {
      log.warn(
        "CloakBrowser shutdown ignored:",
        error instanceof Error ? error.message : error
      );
    }
  }

  clearStaleProfileLocks(profileDir);
}
