# Vercel Deployment Runbook

This repository uses three Vercel projects:

- `hub` -> root directory `apps/hub`
- `codenames` -> root directory `apps/codenames`
- `spyfall` -> root directory `apps/spyfall`

## Required environment variables

### Hub (`apps/hub`)

- `CODENAMES_PROD_ORIGIN=https://<codenames-prod-domain>`
- `SPYFALL_PROD_ORIGIN=https://<spyfall-prod-domain>`
- Optional (local only):
  - `CODENAMES_DEV_ORIGIN=http://localhost:3001`
  - `SPYFALL_DEV_ORIGIN=http://localhost:3002`

### Codenames (`apps/codenames`)

- `NEXT_PUBLIC_BASE_PATH=/codenames`

### Spyfall (`apps/spyfall`)

- `NEXT_PUBLIC_BASE_PATH=/spyfall`

## Routing contract

- Hub always links to same-origin paths:
  - `/codenames?lobby=<code>`
  - `/spyfall?lobby=<code>`
- Hub rewrites forward those paths to `CODENAMES_PROD_ORIGIN` and `SPYFALL_PROD_ORIGIN`.
- Do not use placeholder hostnames (`YOUR_*`, `example.com`, etc.) in production env vars.

## Smoke test checklist

After each production deploy:

1. Open `https://<hub-domain>/`.
2. Open `https://<hub-domain>/codenames`.
3. Open `https://<hub-domain>/spyfall`.
4. Join each game from Hub and confirm the page loads.

Or run the automated guardrail:

```bash
HUB_URL=https://<hub-domain> \
CODENAMES_URL=https://<codenames-domain> \
SPYFALL_URL=https://<spyfall-domain> \
npm run smoke:routes
```

## Safe URL rotation process

When changing minigame domains:

1. Deploy Codenames and Spyfall first.
2. Update Hub env vars `CODENAMES_PROD_ORIGIN` and `SPYFALL_PROD_ORIGIN`.
3. Redeploy Hub.
4. Run smoke checks.
