import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import {
  assertValidProdOrigins,
  buildMinigameRewrites,
  getDevOrigins,
  getProdOrigins,
} from "./lib/minigameRouting";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@minigames/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return buildMinigameRewrites(getDevOrigins());
    }

    const prodOrigins = getProdOrigins();
    assertValidProdOrigins(prodOrigins);
    return buildMinigameRewrites(prodOrigins);
  },
};

export default nextConfig;
