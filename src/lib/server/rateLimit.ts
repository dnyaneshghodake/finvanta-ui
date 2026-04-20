/**
 * BFF-level rate limiter for auth endpoints.
 * @file src/lib/server/rateLimit.ts
 *
 * Per RBI Cyber Security Framework 2024 §6.2 and API_LOGIN_CONTRACT.md:
 * the Spring backend rate-limits at 20 req/IP burst, 1 token/6s refill.
 * The BFF adds a second layer to reject floods BEFORE they reach Spring,
 * protecting the Node.js event loop from crypto/JSON overhead.
 *
 * Implementation: in-memory sliding window counter per IP.
 * Suitable for single-instance deployments. For multi-instance (K8s),
 * replace with Redis-backed counter via `@upstash/ratelimit`.
 *
 * CBS benchmark: Tier-1 CBS portal uses a Servlet filter with Guava
 * RateLimiter; this is the equivalent for the Next.js BFF layer.
 */
import "server-only";

interface WindowEntry {
  /** Request timestamps within the current window. */
  timestamps: number[];
  /** When this entry was last accessed (for cleanup). */
  lastAccess: number;
}

const store = new Map<string, WindowEntry>();

/** Cleanup stale entries every 5 minutes to prevent memory leaks. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
/** Entries older than this are evicted. */
const ENTRY_TTL_MS = 15 * 60 * 1000;

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - ENTRY_TTL_MS;
  for (const [key, entry] of store) {
    if (entry.lastAccess < cutoff) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Seconds until the window resets (for Retry-After header). */
  retryAfterSeconds: number;
}

export interface RateLimitConfig {
  /** Maximum requests per window. Default: 20 (matches Spring). */
  maxRequests?: number;
  /** Window size in seconds. Default: 60. */
  windowSeconds?: number;
}

/**
 * Check and consume a rate limit token for the given key (typically IP).
 *
 * Uses a sliding window: counts requests in the last `windowSeconds`.
 * Old timestamps outside the window are pruned on each check.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = {},
): RateLimitResult {
  const { maxRequests = 20, windowSeconds = 60 } = config;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;

  cleanup();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], lastAccess: now };
    store.set(key, entry);
  }

  // Prune timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
  entry.lastAccess = now;

  if (entry.timestamps.length >= maxRequests) {
    // Rate limited — calculate when the oldest request exits the window
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(Math.max(retryAfterMs, 1000) / 1000),
    };
  }

  // Allow and record
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Extract client IP from Next.js request headers.
 * Prefers X-Forwarded-For (set by load balancers), falls back to
 * X-Real-IP, then the connection remote address.
 *
 * CWE-117 mitigation: sanitize the extracted IP to prevent log
 * injection via crafted headers. Only allow [0-9a-fA-F.:] (IPv4,
 * IPv6, and port separators). Anything else is stripped.
 */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const raw = xff
    ? xff.split(",")[0].trim()
    : (headers.get("x-real-ip") || "unknown");
  // Strip characters that are not valid in IPv4/IPv6 addresses.
  // This prevents CRLF injection, log forging, and unbounded Map keys.
  return raw.replace(/[^0-9a-fA-F.:]/g, "").slice(0, 45) || "unknown";
}
