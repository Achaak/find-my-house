export class LeboncoinAccessBlockedError extends Error {
  readonly statusCode: number;

  constructor(statusCode = 403) {
    super(`LeBonCoin: accès bloqué (HTTP ${String(statusCode)})`);
    this.name = "LeboncoinAccessBlockedError";
    this.statusCode = statusCode;
  }
}
