# Vercel Deployment Runbook

This repository uses three Vercel projects:

- `hub` -> root directory `apps/hub`
- `codenames` -> root directory `apps/codenames`
- `imposter` -> root directory `apps/imposter`

## Required environment variables

### Hub (`apps/hub`)

- `CODENAMES_PROD_ORIGIN=https://<codenames-prod-domain>`
- `IMPOSTER_PROD_ORIGIN=https://<imposter-prod-domain>`
- Optional (local only):
  - `CODENAMES_DEV_ORIGIN=http://localhost:3001`
  - `IMPOSTER_DEV_ORIGIN=http://localhost:3002`

### Codenames (`apps/codenames`)

- `NEXT_PUBLIC_BASE_PATH=/codenames`

### Imposter (`apps/imposter`)

- `NEXT_PUBLIC_BASE_PATH=/imposter`

## Routing contract

- Hub always links to same-origin paths:
  - `/codenames?lobby=<code>`
  - `/imposter?lobby=<code>`
- Hub rewrites forward those paths to `CODENAMES_PROD_ORIGIN` and `IMPOSTER_PROD_ORIGIN`.
- Do not use placeholder hostnames (`YOUR_*`, `example.com`, etc.) in production env vars.

## Smoke test checklist

After each production deploy:

1. Open `https://<hub-domain>/`.
2. Open `https://<hub-domain>/codenames`.
3. Open `https://<hub-domain>/imposter`.
4. Join each game from Hub and confirm the page loads.

Or run the automated guardrail:

```bash
HUB_URL=https://<hub-domain> \
CODENAMES_URL=https://<codenames-domain> \
IMPOSTER_URL=https://<imposter-domain> \
npm run smoke:routes
```

## Safe URL rotation process

When changing minigame domains:

1. Deploy Codenames and Imposter first.
2. Update Hub env vars `CODENAMES_PROD_ORIGIN` and `IMPOSTER_PROD_ORIGIN`.
3. Redeploy Hub.
4. Run smoke checks.
