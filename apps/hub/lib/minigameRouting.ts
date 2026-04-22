type MinigameOriginEnv = {
  codenamesOrigin: string;
  spyfallOrigin: string;
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
    spyfallOrigin: normalizeOrigin(process.env.SPYFALL_DEV_ORIGIN) || "http://localhost:3002",
  };
}

export function getProdOrigins(): MinigameOriginEnv {
  return {
    codenamesOrigin: normalizeOrigin(process.env.CODENAMES_PROD_ORIGIN),
    spyfallOrigin: normalizeOrigin(process.env.SPYFALL_PROD_ORIGIN),
  };
}

export function assertValidProdOrigins(origins: MinigameOriginEnv): void {
  const problems: string[] = [];

  if (!origins.codenamesOrigin) {
    problems.push("Missing CODENAMES_PROD_ORIGIN.");
  } else if (looksLikePlaceholder(origins.codenamesOrigin)) {
    problems.push("CODENAMES_PROD_ORIGIN still looks like a placeholder value.");
  }

  if (!origins.spyfallOrigin) {
    problems.push("Missing SPYFALL_PROD_ORIGIN.");
  } else if (looksLikePlaceholder(origins.spyfallOrigin)) {
    problems.push("SPYFALL_PROD_ORIGIN still looks like a placeholder value.");
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
      source: "/spyfall",
      destination: `${origins.spyfallOrigin}/spyfall`,
    },
    {
      source: "/spyfall/:path*",
      destination: `${origins.spyfallOrigin}/spyfall/:path*`,
    },
  ];
}
