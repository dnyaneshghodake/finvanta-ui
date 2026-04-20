/**
 * Generic Spring BFF proxy. Every `/api/cbs/<x>` browser call is
 * forwarded to `<backend>/api/v1/<x>` with server-side auth + branch
 * context. The generic catch-all is used for every non-auth REST
 * endpoint; auth and session endpoints have dedicated routes that
 * target specific paths explicitly.
 *
 * Per the audited API Endpoint Catalogue, Spring REST controllers
 * are mapped at `/api/v1/**`. The BFF prepends `/api/v1/` so the browser
 * never needs to know the backend version prefix.
 *
 * The catch-all is NOT a blanket forwarder: it consults the
 * `endpointPolicy` allow-list (src/lib/server/endpointPolicy.ts)
 * and rejects any `{method, path}` pair that is not explicitly
 * listed. This constrains the BFF attack surface to exactly the
 * endpoints the UI uses.
 */
import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/server/proxy";
import { isEndpointAllowed } from "@/lib/server/endpointPolicy";
import { readCorrelationId } from "@/lib/server/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const search = req.nextUrl.search || "";
  // The proxy prepends backendApiBase (e.g. "http://localhost:8080/api/v1")
  // so targetPath is just the resource path relative to the API version root.
  const targetPath = "/" + path.join("/");

  if (!isEndpointAllowed(req.method, targetPath)) {
    const correlationId = readCorrelationId(req);
    // 404 (not 403) so unauthenticated probes cannot distinguish
    // "this endpoint exists but you may not use it" from "no such
    // endpoint". Clients with legitimate needs will see the rejection
    // in the correlation trail and can request an allow-list change.
    return NextResponse.json(
      {
        success: false,
        errorCode: "FORBIDDEN_ENDPOINT",
        message: "The requested endpoint is not part of the BFF allow-list.",
        correlationId,
      },
      {
        status: 404,
        headers: {
          "x-correlation-id": correlationId,
          "cache-control": "no-store",
        },
      },
    );
  }

  return proxyToBackend(req, targetPath, search, {
    requireAuth: true,
    // CSRF double-submit is required on mutating calls only.
    // Safe methods (GET/HEAD/OPTIONS) are exempt per OWASP guidelines.
    requireCsrf: !SAFE_METHODS.has(req.method.toUpperCase()),
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
