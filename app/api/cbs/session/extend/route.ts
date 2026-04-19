/**
 * Extend the session on explicit user action ("Stay logged in"). We
 * refresh the cookie expiry window but do not extend past the
 * absolute TTL ceiling of CBS_SESSION_TTL_SECONDS.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { assertCsrf } from "@/lib/server/csrf";
import { serverEnv } from "@/lib/server/env";
import { readSession, writeSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { success: false, errorCode: "NO_SESSION", correlationId },
      { status: 401, headers: { "x-correlation-id": correlationId } },
    );
  }
  try {
    assertCsrf(req, session);
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "CSRF_REJECTED", correlationId },
      { status: 403, headers: { "x-correlation-id": correlationId } },
    );
  }
  const absoluteCeiling = session.issuedAt + env.sessionTtlSeconds * 1000;
  const idleExtension = Date.now() + 15 * 60 * 1000;
  await writeSession({
    ...session,
    expiresAt: Math.min(idleExtension, absoluteCeiling),
    csrfToken: session.csrfToken,
  });
  return NextResponse.json(
    { success: true, correlationId },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
