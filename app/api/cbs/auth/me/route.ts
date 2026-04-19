/**
 * Returns the current user from the server-side session. Used by the
 * browser's authStore to rehydrate state on page load without exposing
 * the JWT.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "NO_SESSION",
        message: "Not authenticated",
        correlationId,
      },
      { status: 401, headers: { "x-correlation-id": correlationId } },
    );
  }
  return NextResponse.json(
    {
      success: true,
      data: {
        user: session.user,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
        mfaVerifiedAt: session.mfaVerifiedAt ?? null,
        businessDate:
          session.businessDate || new Date().toISOString().slice(0, 10),
        businessDay: session.businessDay ?? null,
        operationalConfig: session.operationalConfig ?? null,
        transactionLimits: session.transactionLimits ?? null,
      },
      correlationId,
    },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
