const hubUrl = (process.env.HUB_URL || "").trim().replace(/\/+$/, "");
const codenamesUrl = (process.env.CODENAMES_URL || "").trim().replace(/\/+$/, "");
const imposterUrl = (process.env.IMPOSTER_URL || "").trim().replace(/\/+$/, "");

if (!hubUrl || !codenamesUrl || !imposterUrl) {
  console.error(
    "Missing required env vars. Set HUB_URL, CODENAMES_URL, and IMPOSTER_URL before running smoke tests."
  );
  process.exit(1);
}

const checks = [
  { name: "hub home", url: `${hubUrl}/` },
  { name: "hub codenames route", url: `${hubUrl}/codenames` },
  { name: "hub imposter route", url: `${hubUrl}/imposter` },
  { name: "codenames direct", url: `${codenamesUrl}/codenames` },
  { name: "imposter direct", url: `${imposterUrl}/imposter` },
];

const failures = [];

for (const check of checks) {
  try {
    const res = await fetch(check.url, { redirect: "manual" });
    const ok = res.status >= 200 && res.status < 400;
    if (!ok) {
      failures.push(`${check.name}: ${check.url} -> ${res.status}`);
      continue;
    }
    console.log(`[ok] ${check.name}: ${check.url} -> ${res.status}`);
  } catch (error) {
    failures.push(`${check.name}: ${check.url} -> ${String(error)}`);
  }
}

if (failures.length > 0) {
  console.error("Route smoke checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("All route smoke checks passed.");
