# Vercel Deployment Runbook

This repository uses four Vercel projects:

- `hub` -> root directory `apps/hub`
- `codenames` -> root directory `apps/codenames`
- `spyfall` -> root directory `apps/spyfall`
- `jeopardy` -> root directory `apps/jeopardy`

## Required environment variables

### Hub (`apps/hub`)

- `CODENAMES_PROD_ORIGIN=https://<codenames-prod-domain>`
- `SPYFALL_PROD_ORIGIN=https://<spyfall-prod-domain>`
- `JEOPARDY_PROD_ORIGIN=https://<jeopardy-prod-domain>`
- Optional (local only):
  - `CODENAMES_DEV_ORIGIN=http://localhost:3001`
  - `SPYFALL_DEV_ORIGIN=http://localhost:3002`
  - `JEOPARDY_DEV_ORIGIN=http://localhost:3003`

### Codenames (`apps/codenames`)

- `NEXT_PUBLIC_BASE_PATH=/codenames`

### Spyfall (`apps/spyfall`)

- `NEXT_PUBLIC_BASE_PATH=/spyfall`

### Jeopardy (`apps/jeopardy`)

- `NEXT_PUBLIC_BASE_PATH=/jeopardy`

## Routing contract

- Hub always links to same-origin paths:
  - `/codenames?lobby=<code>`
  - `/spyfall?lobby=<code>`
  - `/jeopardy` (host projector UI)
- Hub rewrites forward those paths to `CODENAMES_PROD_ORIGIN`, `SPYFALL_PROD_ORIGIN`, and `JEOPARDY_PROD_ORIGIN`.
- Do not use placeholder hostnames (`YOUR_*`, `example.com`, etc.) in production env vars.

## Smoke test checklist

After each production deploy:

1. Open `https://<hub-domain>/`.
2. Open `https://<hub-domain>/codenames`.
3. Open `https://<hub-domain>/spyfall`.
4. Open `https://<hub-domain>/jeopardy/host`.
5. Join each game from Hub and confirm the page loads.

Or run the automated guardrail:

```bash
HUB_URL=https://<hub-domain> \
CODENAMES_URL=https://<codenames-domain> \
SPYFALL_URL=https://<spyfall-domain> \
JEOPARDY_URL=https://<jeopardy-domain> \
npm run smoke:routes
```

## Safe URL rotation process

When changing minigame domains:

1. Deploy Codenames, Spyfall, and Jeopardy first.
2. Update Hub env vars `CODENAMES_PROD_ORIGIN`, `SPYFALL_PROD_ORIGIN`, and `JEOPARDY_PROD_ORIGIN`.
3. Redeploy Hub.
4. Run smoke checks.
