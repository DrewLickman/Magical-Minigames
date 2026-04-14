type MinigameOriginEnv = {
  codenamesOrigin: string;
  imposterOrigin: string;
};

const PLACEHOLDER_MARKERS = ["YOUR_", "example.com", "changeme"];

function normalizeOrigin(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) =>
    value.toLowerCase().includes(marker.toLowerCase())
  );
}

export function getDevOrigins(): MinigameOriginEnv {
  return {
    codenamesOrigin: normalizeOrigin(process.env.CODENAMES_DEV_ORIGIN) || "http://localhost:3001",
    imposterOrigin: normalizeOrigin(process.env.IMPOSTER_DEV_ORIGIN) || "http://localhost:3002",
  };
}

export function getProdOrigins(): MinigameOriginEnv {
  return {
    codenamesOrigin: normalizeOrigin(process.env.CODENAMES_PROD_ORIGIN),
    imposterOrigin: normalizeOrigin(process.env.IMPOSTER_PROD_ORIGIN),
  };
}

export function assertValidProdOrigins(origins: MinigameOriginEnv): void {
  const problems: string[] = [];

  if (!origins.codenamesOrigin) {
    problems.push("Missing CODENAMES_PROD_ORIGIN.");
  } else if (looksLikePlaceholder(origins.codenamesOrigin)) {
    problems.push("CODENAMES_PROD_ORIGIN still looks like a placeholder value.");
  }

  if (!origins.imposterOrigin) {
    problems.push("Missing IMPOSTER_PROD_ORIGIN.");
  } else if (looksLikePlaceholder(origins.imposterOrigin)) {
    problems.push("IMPOSTER_PROD_ORIGIN still looks like a placeholder value.");
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid production minigame routing env configuration: ${problems.join(" ")}`
    );
  }
}

export function buildMinigameRewrites(origins: MinigameOriginEnv) {
  return [
    {
      source: "/codenames",
      destination: `${origins.codenamesOrigin}/codenames`,
    },
    {
      source: "/codenames/:path*",
      destination: `${origins.codenamesOrigin}/codenames/:path*`,
    },
    {
      source: "/imposter",
      destination: `${origins.imposterOrigin}/imposter`,
    },
    {
      source: "/imposter/:path*",
      destination: `${origins.imposterOrigin}/imposter/:path*`,
    },
  ];
}
