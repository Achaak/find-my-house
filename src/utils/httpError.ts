import { HTTPError } from "got";

export function wrapHttpError(prefix: string, error: unknown): never {
  if (error instanceof HTTPError) {
    throw new Error(`${prefix}: HTTP ${String(error.response.statusCode)}`, {
      cause: error,
    });
  }

  throw error;
}
