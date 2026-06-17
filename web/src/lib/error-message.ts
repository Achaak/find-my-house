import * as m from "@/paraglide/messages.js";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return m.error_generic();
}
