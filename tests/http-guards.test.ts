import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { BodyTooLargeError, rateLimitKeyFromHeaders, readJsonBody } from "../src/http-guards.js";
import type { IncomingMessage } from "node:http";

function bodyStream(value: string): IncomingMessage {
  return Readable.from([Buffer.from(value)]) as unknown as IncomingMessage;
}

describe("HTTP bridge guards", () => {
  it("uses forwarded IP only when proxy trust is enabled", () => {
    const headers = { "x-forwarded-for": "203.0.113.10, 10.0.0.5" };
    expect(rateLimitKeyFromHeaders(headers, "127.0.0.1", false)).toBe("127.0.0.1");
    expect(rateLimitKeyFromHeaders(headers, "127.0.0.1", true)).toBe("203.0.113.10");
  });

  it("parses bounded JSON bodies", async () => {
    await expect(readJsonBody(bodyStream('{"limit":5}'), 64)).resolves.toEqual({ limit: 5 });
  });

  it("rejects oversized bodies before buffering all content", async () => {
    await expect(readJsonBody(bodyStream('{"payload":"too-large"}'), 12)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
