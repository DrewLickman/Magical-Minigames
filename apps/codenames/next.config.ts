import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

// #region agent log
fetch("http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6b0f53"},body:JSON.stringify({sessionId:"6b0f53",runId:process.env.VERCEL_GIT_COMMIT_SHA||`local-${Date.now()}`,hypothesisId:"H3",location:"apps/codenames/next.config.ts:11",message:"Codenames next config evaluated",data:{cwd:process.cwd(),nodeEnv:process.env.NODE_ENV||null,basePath},timestamp:Date.now()})}).catch(()=>{});
// #endregion

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  transpilePackages: ["@minigames/shared"],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
