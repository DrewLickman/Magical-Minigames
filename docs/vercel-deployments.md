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
- `JEOPARDY_PROD_ORIGIN=https://<jeopardy-prod-domain>` (optional: omit until the Jeopardy project is deployed; hub builds without `/jeopardy` rewrites until this is set)
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
- **`NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL`** (recommended for any remote/hosted play): full WebSocket URL baked into the browser bundle so host and buzzer pages connect to your buzzer process — for example `wss://buzzer.example.com` (no trailing slash; path/port must match how you expose the server). Must use `wss:` when the game UI is served over HTTPS.

## Jeopardy buzzer server (production)

The Jeopardy Next.js app on Vercel is **only** the web UI. The realtime buzzer protocol runs in [`apps/jeopardy/scripts/buzzer-server.mjs`](../apps/jeopardy/scripts/buzzer-server.mjs): a long-lived **WebSocket** server (`ws`). Serverless functions cannot replace it without a redesign, so you run this script on a small **always-on** host and point the UI at it.

### Suggested deployment shape

1. Deploy or run Node on a VPS, homelab, or a platform that keeps one process up (for example Fly Machines, Railway, or a systemd service).
2. Start the buzzer with `node scripts/buzzer-server.mjs` from `apps/jeopardy` (or run your built artifact); set **`JEOPARDY_BUZZER_PORT`** if the default **8787** is taken.
3. Terminate **TLS** in front of the process (platform HTTPS proxy, Caddy, nginx, etc.) so browsers get **`wss://`**.
4. Set **`NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL`** on the **Jeopardy Vercel project** to that `wss://` URL, then redeploy Jeopardy so clients embed the correct endpoint.

### Security and abuse notes

- **Trust model:** rooms are identified by IDs shared via invite links; anyone who can guess or intercept a room ID could join that room. Treat invites like lobby passwords for a house party, not a hardened credential.
- **Expose minimally:** prefer not exposing the buzzer port on the public internet until you need remote play; LAN-only parties can omit `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` and use the local banner flow documented in the Jeopardy README.
- **Payload limits:** the server caps signature payload size; avoid raising limits without considering memory and denial-of-service risk.

More operator detail: [Jeopardy README — troubleshooting and env](../apps/jeopardy/README.md).

## Routing contract

- Hub always links to same-origin paths:
  - `/codenames?lobby=<code>`
  - `/spyfall?lobby=<code>`
  - `/jeopardy` (host projector UI)
- Hub rewrites forward those paths to `CODENAMES_PROD_ORIGIN`, `SPYFALL_PROD_ORIGIN`, and `JEOPARDY_PROD_ORIGIN`.
- Do not use placeholder hostnames (`YOUR_*`, `example.com`, etc.) in production env vars.

## GitHub Actions (routing smoke)

The workflow [`.github/workflows/routing-smoke-check.yml`](../.github/workflows/routing-smoke-check.yml) runs on pushes to `main` (and manual dispatch). Configure these **repository secrets** so `npm run smoke:routes` can reach each deployed origin:

| Secret | Purpose |
| --- | --- |
| `HUB_URL` | Hub production origin (no trailing slash), e.g. `https://hub.example.com` |
| `CODENAMES_URL` | Codenames project origin |
| `SPYFALL_URL` | Spyfall project origin |
| `JEOPARDY_URL` | Jeopardy project origin |

These are the same values you would pass as `HUB_URL`, `CODENAMES_URL`, `SPYFALL_URL`, and `JEOPARDY_URL` when running the smoke script locally (see below).

Pull requests and pushes to `main` also run **[`ci.yml`](../.github/workflows/ci.yml)** (`lint`, `typecheck`, `test`, `build` across workspaces).

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
