/**
 * Session heartbeat. The client calls this every 30 seconds to get a
 * server-synced countdown (ttl in seconds) rather than trusting a
 * client-side timer. Returns warning=true when remaining <= 120s so
 * the SessionCountdownBanner can flip to the 2-minute warning state.
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
      { success: false, errorCode: "NO_SESSION", correlationId },
      { status: 401, headers: { "x-correlation-id": correlationId } },
    );
  }
  const remainingSeconds = Math.max(
    0,
    Math.floor((session.expiresAt - Date.now()) / 1000),
  );
  // Business date: prefer the server-session value (populated from
  // Spring DayOpenService at login). Fall back to the BFF server's
  // clock date so the Header never needs `new Date()` on the client.
  const businessDate =
    session.businessDate ||
    new Date().toISOString().slice(0, 10);
  return NextResponse.json(
    {
      success: true,
      data: {
        remainingSeconds,
        warning: remainingSeconds <= 120,
        expiresAt: session.expiresAt,
        businessDate,
        businessDay: session.businessDay ?? null,
      },
      correlationId,
    },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
