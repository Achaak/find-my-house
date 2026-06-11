import { HTTPError } from "../http/client.js";

export function wrapHttpError(context: string, error: unknown): never {
  if (error instanceof HTTPError) {
    throw new Error(
      `${context}: HTTP ${String(error.response.statusCode)} ${error.response.statusMessage ?? ""}`.trim(),
      { cause: error }
    );
  }

  throw error;
}
