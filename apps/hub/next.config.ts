import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

const codenamesDevOrigin =
  process.env.CODENAMES_DEV_ORIGIN?.trim() || "http://localhost:3001";
const imposterDevOrigin =
  process.env.IMPOSTER_DEV_ORIGIN?.trim() || "http://localhost:3002";

const nextConfig: NextConfig = {
  transpilePackages: ["@minigames/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const codenamesOrigin = codenamesDevOrigin.replace(/\/$/, "");
    const imposterOrigin = imposterDevOrigin.replace(/\/$/, "");
    return [
      {
        source: "/codenames",
        destination: `${codenamesOrigin}/codenames`,
      },
      {
        source: "/codenames/:path*",
        destination: `${codenamesOrigin}/codenames/:path*`,
      },
      {
        source: "/imposter",
        destination: `${imposterOrigin}/imposter`,
      },
      {
        source: "/imposter/:path*",
        destination: `${imposterOrigin}/imposter/:path*`,
      },
    ];
  },
};

export default nextConfig;
