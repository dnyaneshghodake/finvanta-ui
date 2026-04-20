/**
 * Next.js configuration for FINVANTA CBS UI.
 *
 * The per-request CSP nonce is emitted by `proxy.ts` (Next.js 16's
 * replacement for `middleware.ts`). This `headers()` block provides
 * the static security baseline that applies to every response —
 * including static assets that `proxy.ts` does not intercept.
 *
 * Controls (RBI Master Direction on IT Governance 2023 §8, RBI
 * Cyber-Security Framework for UCBs 2024 §6, OWASP ASVS 4.0 L2):
 *   - Strict-Transport-Security  (HSTS preload)
 *   - X-Frame-Options             (DENY — UI is never framed)
 *   - X-Content-Type-Options      (nosniff)
 *   - Referrer-Policy             (strict-origin-when-cross-origin)
 *   - Permissions-Policy          (deny all powerful browser APIs)
 *   - Cross-Origin-Opener-Policy  (same-origin)
 *   - Cross-Origin-Embedder-Policy (credentialless)
 *   - Cross-Origin-Resource-Policy (same-origin)
 *
 * Notes:
 *   - `X-Frame-Options: DENY` matches `frame-ancestors 'none'` in
 *     the nonce-bearing CSP emitted by `proxy.ts`. A banking UI
 *     must never load inside a third-party iframe (clickjacking).
 *   - HSTS is only appended in production — `localhost` is HTTP.
 */
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const baselineHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), clipboard-read=(self), clipboard-write=(self), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), hid=(), interest-cohort=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), sync-xhr=(self), usb=(), web-share=(), xr-spatial-tracking=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Required for the Docker multi-stage build (Dockerfile:26) which
  // copies .next/standalone as the production runtime. Without this,
  // `next build` does not emit the standalone directory and the
  // container fails to start.
  output: "standalone",

  async headers() {
    return [
      {
        // Apply the security baseline to every path. The per-request
        // CSP nonce is added by proxy.ts on top of (and replacing)
        // any CSP defined here.
        source: "/(.*)",
        headers: baselineHeaders,
      },
    ];
  },
};

export default nextConfig;
