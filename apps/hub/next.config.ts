import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

const codenamesDevOrigin =
  process.env.CODENAMES_DEV_ORIGIN?.trim() || "http://localhost:3001";
const imposterDevOrigin =
  process.env.IMPOSTER_DEV_ORIGIN?.trim() || "http://localhost:3002";

// #region agent log
fetch("http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6b0f53"},body:JSON.stringify({sessionId:"6b0f53",runId:process.env.VERCEL_GIT_COMMIT_SHA||`local-${Date.now()}`,hypothesisId:"H2",location:"apps/hub/next.config.ts:13",message:"Hub next config evaluated",data:{cwd:process.cwd(),nodeEnv:process.env.NODE_ENV||null,codenamesDevOrigin,imposterDevOrigin},timestamp:Date.now()})}).catch(()=>{});
// #endregion

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
