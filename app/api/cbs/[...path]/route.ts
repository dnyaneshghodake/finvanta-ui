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
 */
import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const search = req.nextUrl.search || "";
  const targetPath = "/api/v1/" + path.join("/");
  return proxyToBackend(req, targetPath, search, {
    requireAuth: true,
    // CSRF double-submit is required on mutating calls only.
    // Safe methods (GET/HEAD/OPTIONS) are exempt per OWASP guidelines.
    requireCsrf: !SAFE_METHODS.has(req.method.toUpperCase()),
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
