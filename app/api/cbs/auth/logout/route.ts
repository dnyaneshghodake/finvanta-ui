/**
 * BFF logout endpoint. Best-effort calls Spring `/logout` to revoke
 * the JWT on the server, then clears the session cookies regardless
 * of the upstream outcome so the browser is always logged out.
 *
 * CSRF is enforced: without it, a malicious page can forge a cross-
 * origin POST and log the operator out (CWE-352 — CSRF logout).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { assertCsrf } from "@/lib/server/csrf";
import { serverEnv } from "@/lib/server/env";
import { clearSession, readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const session = await readSession();

  // Validate CSRF before processing the logout. If the session is
  // already gone (expired, cleared) we still clear cookies below —
  // but a forged cross-origin POST without a valid CSRF token is
  // rejected.
  if (session) {
    try {
      assertCsrf(req, session);
    } catch {
      return NextResponse.json(
        { success: false, errorCode: "CSRF_REJECTED", correlationId },
        { status: 403, headers: { "x-correlation-id": correlationId } },
      );
    }
  }

  if (session?.accessToken) {
    await fetch(`${env.backendBaseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `${session.tokenType} ${session.accessToken}`,
        "x-correlation-id": correlationId,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json(
    { success: true, correlationId },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
