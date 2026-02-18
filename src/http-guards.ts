import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

export class BodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
    this.name = "BodyTooLargeError";
  }
}

export function rateLimitKeyFromHeaders(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
  trustProxy: boolean
): string {
  if (trustProxy) {
    const forwarded = headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const firstAddress = raw?.split(",")[0]?.trim();
    if (firstAddress) {
      return firstAddress;
    }
  }
  return remoteAddress ?? "unknown";
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  trustProxy: boolean;
}): (request: IncomingMessage) => boolean {
  const requestCounts = new Map<string, { windowStart: number; count: number }>();
  return (request: IncomingMessage): boolean => {
    const now = Date.now();
    const key = rateLimitKeyFromHeaders(request.headers, request.socket.remoteAddress, options.trustProxy);
    const current = requestCounts.get(key);
    if (!current || now - current.windowStart >= options.windowMs) {
      requestCounts.set(key, { windowStart: now, count: 1 });
      return false;
    }
    current.count += 1;
    return current.count > options.maxRequests;
  };
}

export async function readJsonBody(request: IncomingMessage, limitBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Buffer);
    totalBytes += buffer.length;
    if (totalBytes > limitBytes) {
      throw new BodyTooLargeError(limitBytes);
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  return raw ? JSON.parse(raw) : {};
}
