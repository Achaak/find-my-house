import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it("writes info messages with scope prefix", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    createLogger("test").info("hello");

    expect(info).toHaveBeenCalledWith("[test] hello");
  });

  it("respects LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "error";
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    createLogger("test").info("hidden");
    createLogger("test").error("visible");

    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[test] visible");
  });
});
