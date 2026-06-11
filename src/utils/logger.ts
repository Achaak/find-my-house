type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

export type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

export function createLogger(scope: string): Logger {
  const minLevel = resolveMinLevel();

  const write = (
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): void => {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

    const line = `[${scope}] ${message}`;
    if (level === "error") {
      console.error(line, ...args);
      return;
    }
    if (level === "warn") {
      console.warn(line, ...args);
      return;
    }
    console.log(line, ...args);
  };

  return {
    debug: (message, ...args) => {
      write("debug", message, ...args);
    },
    info: (message, ...args) => {
      write("info", message, ...args);
    },
    warn: (message, ...args) => {
      write("warn", message, ...args);
    },
    error: (message, ...args) => {
      write("error", message, ...args);
    },
  };
}
