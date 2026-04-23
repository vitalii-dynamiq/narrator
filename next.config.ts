import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces `.next/standalone/server.js` — a self-contained Node server that
  // the production Docker image runs directly (no `next start` shim, minimal
  // node_modules). Reads `PORT` and `HOSTNAME` from env at runtime.
  output: "standalone",
};

export default nextConfig;
