import {
  clearBrowserCookiesForHost,
  isBrowserAccessBlocked,
  warmUpBrowserSession,
} from "./client.js";

export type BrowserFetchRetryOptions<T> = {
  maxAttempts: number;
  retryDelayMs: number;
  warmUpOrigin: string;
  clearCookiesHost?: string;
  beforeEachAttempt?: () => Promise<void>;
  onAccessBlocked?: (error: unknown) => never;
  run: () => Promise<T>;
};

export async function retryBrowserOperation<T>(
  options: BrowserFetchRetryOptions<T>
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    await warmUpBrowserSession(options.warmUpOrigin);
    await options.beforeEachAttempt?.();

    try {
      return await options.run();
    } catch (error) {
      if (isBrowserAccessBlocked(error) && options.onAccessBlocked) {
        options.onAccessBlocked(error);
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= options.maxAttempts) {
        throw lastError;
      }

      if (options.clearCookiesHost) {
        void clearBrowserCookiesForHost(options.clearCookiesHost);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, options.retryDelayMs * attempt)
      );
    }
  }

  throw lastError ?? new Error("Browser fetch failed");
}
