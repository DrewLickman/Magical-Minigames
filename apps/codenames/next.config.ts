import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

/** Default matches runbook; must match hub rewrites (`/codename`). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/codename";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  transpilePackages: ["@minigames/shared"],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
