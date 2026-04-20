// DEPRECATED: Implementation moved to middleware.ts.
// This file is kept empty to avoid import breakage from
// src/lib/server/proxy.ts which has a different purpose
// (BFF reverse-proxy to Spring, not the Next.js entry point).
//
// Next.js 16.2.4 detects proxy.ts by filename. Having exports
// here while middleware.ts also exists causes a fatal conflict.
// Do NOT add exports to this file.
