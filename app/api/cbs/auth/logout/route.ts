/**
 * BFF logout endpoint. Best-effort calls Spring `/logout` to revoke
 * the JWT on the server, then clears the session cookies regardless
 * of the upstream outcome so the browser is always logged out.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { serverEnv } from "@/lib/server/env";
import { clearSession, readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const env = serverEnv();
  const session = await readSession();
  if (session?.accessToken) {
    await fetch(`${env.backendBaseUrl}/v1/auth/logout`, {
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
