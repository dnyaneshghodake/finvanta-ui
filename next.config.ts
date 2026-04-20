import type { NextConfig } from "next";
import { renameSync, existsSync } from "fs";
import { join } from "path";

// ── Auto-cleanup: remove root proxy.ts if it conflicts with middleware.ts ──
// Next.js 16.2.4 detects both proxy.ts and middleware.ts by filename and
// refuses to start. The security headers implementation lives in middleware.ts;
// proxy.ts at the root is a leftover from the Next.js 16 migration attempt.
// This self-healing block renames it synchronously before Next.js scans for
// convention files, so `npm run dev` works without manual intervention.
const rootProxy = join(process.cwd(), "proxy.ts");
const rootProxyBackup = join(process.cwd(), "proxy.ts.bak");
if (existsSync(rootProxy)) {
  try {
    renameSync(rootProxy, rootProxyBackup);
  } catch {
    // Silently ignore if rename fails (e.g. read-only filesystem in CI).
  }
}

const nextConfig: NextConfig = {
  // Required for the Docker multi-stage build (Dockerfile:26) which
  // copies .next/standalone as the production runtime. Without this,
  // `next build` does not emit the standalone directory and the
  // container fails to start.
  output: "standalone",
};

export default nextConfig;
