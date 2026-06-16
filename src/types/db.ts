export type RepositoryWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function repositoryWriteError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
