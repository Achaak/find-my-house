export class LeboncoinAccessBlockedError extends Error {
  readonly statusCode: number;

  constructor(statusCode = 403) {
    super(`LeBonCoin: access blocked (HTTP ${String(statusCode)})`);
    this.name = "LeboncoinAccessBlockedError";
    this.statusCode = statusCode;
  }
}
