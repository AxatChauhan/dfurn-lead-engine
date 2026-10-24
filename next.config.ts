import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/**": ["./data/dfurn_lead_engine.db"],
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "100.68.*.*"
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
