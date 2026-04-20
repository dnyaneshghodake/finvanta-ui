/**
 * BFF health check endpoint.
 *
 * Proxies to Spring's `/actuator/health` (per REST_API_COMPLETE_CATALOGUE
 * §Actuator) and returns a normalised status for the UI. This endpoint
 * is intentionally unauthenticated — it mirrors the Spring actuator's
 * public access model so K8s probes, Docker healthchecks, and the UI's
 * backend-status indicator can all use it without a session.
 *
 * The UI polls this every 30s from the dashboard layout to show a
 * "Backend Offline" banner when Spring is down, giving operators a
 * clear signal that the outage is server-side (not their session).
 */
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface BackendHealthResponse {
  /** "UP" | "DOWN" | "UNKNOWN" — mirrors Spring Actuator status. */
  backendStatus: "UP" | "DOWN" | "UNKNOWN";
  /** ISO timestamp of this check. */
  checkedAt: string;
  /** Spring's detailed component status (only when UP and details available). */
  components?: Record<string, { status: string }>;
}

export async function GET() {
  const env = serverEnv();
  const checkedAt = new Date().toISOString();

  try {
    const upstream = await fetch(
      `${env.backendBaseUrl}/actuator/health`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        // 5-second timeout — health checks must be fast.
        signal: AbortSignal.timeout(5000),
      },
    );

    if (upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: true,
          data: {
            backendStatus: body.status === "UP" ? "UP" : "DOWN",
            checkedAt,
            components: body.components ?? undefined,
          } satisfies BackendHealthResponse,
        },
        {
          status: 200,
          headers: { "cache-control": "no-store, max-age=0" },
        },
      );
    }

    // Spring returned 503 (DOWN) or another non-OK status.
    return NextResponse.json(
      {
        success: true,
        data: {
          backendStatus: "DOWN",
          checkedAt,
        } satisfies BackendHealthResponse,
      },
      {
        status: 200,
        headers: { "cache-control": "no-store, max-age=0" },
      },
    );
  } catch {
    // Network error — ECONNREFUSED, DNS failure, timeout.
    return NextResponse.json(
      {
        success: true,
        data: {
          backendStatus: "DOWN",
          checkedAt,
        } satisfies BackendHealthResponse,
      },
      {
        status: 200,
        headers: { "cache-control": "no-store, max-age=0" },
      },
    );
  }
}
