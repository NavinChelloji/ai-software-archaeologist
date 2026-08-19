import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import pino from "pino";
import { withContext } from "./index";

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ base: { service: "test-service" } }, stream);
  return { logger, lines };
}

describe("withContext", () => {
  it("attaches correlation and pipeline ids to every log line", () => {
    const { logger, lines } = captureLogger();
    const scoped = withContext(logger, { correlationId: "corr-1", repoId: "repo-1" });

    scoped.info("hello");

    const entry = JSON.parse(lines[0]);
    expect(entry.service).toBe("test-service");
    expect(entry.correlationId).toBe("corr-1");
    expect(entry.repoId).toBe("repo-1");
    expect(entry.msg).toBe("hello");
  });
});
