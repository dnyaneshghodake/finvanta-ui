/**
 * HO-only branch switch. The browser sends the target branchCode; we
 * verify the upstream Spring endpoint authorises the switch (role +
 * allowed-branch list) and then rewrite the session's branchCode so
 * every subsequent BFF call carries the new branch context.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readCorrelationId } from "@/lib/server/correlation";
import { serverEnv } from "@/lib/server/env";
import { readSession, writeSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SwitchBody {
  branchCode: string;
}

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
  const body = (await req.json().catch(() => ({}))) as Partial<SwitchBody>;
  if (!body.branchCode) {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_BRANCH", message: "branchCode is required", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } },
    );
  }

  const upstream = await fetch(
    `${env.backendBaseUrl}/api/v1/session/switch-branch`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `${session.tokenType} ${session.accessToken}`,
        "x-correlation-id": correlationId,
        accept: "application/json",
      },
      body: JSON.stringify({ branchCode: body.branchCode }),
      cache: "no-store",
    },
  );

  const json = (await upstream.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { branchCode: string; branchName?: string };
    errorCode?: string;
    message?: string;
  };
  if (!upstream.ok || !json.data?.branchCode) {
    return NextResponse.json(
      { success: false, errorCode: json.errorCode || "BRANCH_SWITCH_FAILED", message: json.message, correlationId },
      { status: upstream.status, headers: { "x-correlation-id": correlationId } },
    );
  }

  await writeSession({
    ...session,
    user: {
      ...session.user,
      branchCode: json.data.branchCode,
      branchName: json.data.branchName || session.user.branchName,
    },
    csrfToken: session.csrfToken,
  });

  return NextResponse.json(
    { success: true, data: json.data, correlationId },
    { status: 200, headers: { "x-correlation-id": correlationId } },
  );
}
