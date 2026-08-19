import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { backendBaseEnvShape, booleanFromString, loadEnv, portSchema } from "./index";

describe("loadEnv", () => {
  const schema = z.object({ ...backendBaseEnvShape, PORT: portSchema });

  it("parses a valid environment", () => {
    const config = loadEnv(schema, {
      NODE_ENV: "test",
      QUEUE_DATABASE_URL: "postgres://localhost:5432/aca_queue",
      REDIS_URL: "redis://localhost:6379",
      INTERNAL_JWT_SECRET: "a".repeat(32),
      PORT: "3100",
    });
    expect(config.PORT).toBe(3100);
    expect(config.NODE_ENV).toBe("test");
  });

  it("exits the process when required fields are missing", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv(schema, { PORT: "3100" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("booleanFromString", () => {
  it.each([
    ["true", true],
    ["1", true],
    ["yes", true],
    ["false", false],
    ["0", false],
    ["no", false],
  ])("coerces %s to %s", (input, expected) => {
    expect(booleanFromString.parse(input)).toBe(expected);
  });
});
