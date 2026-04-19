/**
 * Generic Spring BFF proxy. Every `/api/cbs/<x>` browser call is
 * forwarded to `<backend>/api/v1/<x>` with server-side auth + branch
 * context. The generic catch-all is used for every non-auth REST
 * endpoint; auth and session endpoints have dedicated routes that
 * target non-v1 paths explicitly.
 *
 * CBS REST surface is versioned at `/api/v1/**` on Spring; the UI
 * contract is deliberately version-agnostic so the browser never has
 * to know the backend version prefix.
 */
import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const search = req.nextUrl.search || "";
  const targetPath = "/api/v1/" + path.join("/");
  return proxyToBackend(req, targetPath, search, {
    requireAuth: true,
    requireCsrf: true,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
