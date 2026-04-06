import { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WINDOW_MS = 60_000; // 1 minute
const MAX_MUTATING = 10; // max mutating requests per window per IP
const MAX_READ = 100; // max read requests per window per IP

function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1"
  );
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  // Exempt internal routes
  if (c.req.path.startsWith("/api/internal/")) {
    return next();
  }

  const ip = getClientIp(c);
  const isMutating = MUTATING_METHODS.has(c.req.method);
  const key = `${ip}:${isMutating ? "mut" : "read"}`;
  const limit = isMutating ? MAX_MUTATING : MAX_READ;

  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count++;

  // Set rate limit headers
  const remaining = Math.max(0, limit - entry.count);
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > limit) {
    return c.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests, please try again later",
        },
      },
      429
    );
  }

  return next();
}
