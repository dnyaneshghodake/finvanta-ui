import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker multi-stage build (Dockerfile:26) which
  // copies .next/standalone as the production runtime. Without this,
  // `next build` does not emit the standalone directory and the
  // container fails to start.
  output: "standalone",
};

export default nextConfig;
