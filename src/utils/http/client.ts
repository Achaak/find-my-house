import got, { type ExtendOptions, HTTPError } from "got";

const DEFAULT_RETRY: ExtendOptions["retry"] = {
  limit: 3,
  methods: ["GET", "POST"],
  statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
  errorCodes: [
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
  ],
  calculateDelay: ({ attemptCount }) => 1_000 * 2 ** (attemptCount - 1),
};

export const httpClient = got.extend({
  retry: DEFAULT_RETRY,
  timeout: { request: 30_000 },
});

export function createHttpClient(options?: ExtendOptions) {
  return httpClient.extend(options ?? {});
}

/** ADEME public datasets can be slow — longer timeout, same retry policy. */
export const ademeHttpClient = httpClient.extend({
  timeout: { request: 45_000 },
});

export { HTTPError };
