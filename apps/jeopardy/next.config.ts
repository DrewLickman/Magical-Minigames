import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/jeopardy";
const allowedDevOrigins = (
  process.env.JEOPARDY_ALLOWED_DEV_ORIGINS?.trim() || "10.0.0.78"
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  allowedDevOrigins,
  transpilePackages: ["@minigames/shared"],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
