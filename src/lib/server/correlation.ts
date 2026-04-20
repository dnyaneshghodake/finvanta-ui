/**
 * Per-request correlation id helper.
 *
 * The root proxy (proxy.ts) seeds x-correlation-id on every
 * inbound request. Route handlers should read it via this helper so
 * the same id propagates to Spring via the BFF proxy and out to the
 * browser via the response header — producing an end-to-end trace
 * that an operator can quote as "Ref: <id>" from a support ticket.
 */
import "server-only";
import type { NextRequest } from "next/server";

const CORRELATION_HEADER = "x-correlation-id";
const CORRELATION_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export function readCorrelationId(req: NextRequest): string {
  const forwarded = req.headers.get(CORRELATION_HEADER);
  if (forwarded && CORRELATION_PATTERN.test(forwarded)) return forwarded;
  return crypto.randomUUID();
}

export { CORRELATION_HEADER, CORRELATION_PATTERN };
