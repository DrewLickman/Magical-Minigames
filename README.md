# Magical Minigames

Monorepo of party-style minigames: a **hub** app routes same-origin paths to separate Next.js deployments for **Codenames**, **Spyfall**, and **Jeopardy**.

## Requirements

- Node.js 22+ (matches CI)
- npm 9+

## Quick start

From the repository root:

```bash
npm install
npm run dev
```

This starts all four apps locally:

| App       | Port |
| --------- | ---- |
| Hub       | 3000 |
| Codenames | 3001 |
| Spyfall   | 3002 |
| Jeopardy  | 3003 |

Open [http://localhost:3000](http://localhost:3000).

For Jeopardy host + LAN buzzer server together:

```bash
npm run dev:jeopardy:party
```

## Environment (local)

Configure `.env.local` per app so the hub can proxy to child dev servers. See [apps/hub/README.md](apps/hub/README.md) for copy-paste blocks.

## Documentation

- [Hub & local routing](apps/hub/README.md)
- [Codenames](apps/codenames/README.md)
- [Jeopardy host & buzzer](apps/jeopardy/README.md)
- [Vercel deployments & smoke checks](docs/vercel-deployments.md)

## Scripts (root)

| Script          | Description                                      |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Run hub + all minigames in parallel              |
| `npm run lint`  | ESLint in every workspace that defines `lint`    |
| `npm run typecheck` | `tsc --noEmit` in workspaces that define it |
| `npm run build` | Production build for each Next app (hub needs `CODENAMES_PROD_ORIGIN` and `SPYFALL_PROD_ORIGIN`; CI supplies placeholders — see [`docs/vercel-deployments.md`](docs/vercel-deployments.md)) |
| `npm run test`  | Tests (currently `@minigames/shared`)            |
| `npm run smoke:routes` | HTTP smoke checks (needs URL env vars; see deploy doc) |

## Repository layout

```
apps/hub          # Entry UI + rewrites to minigame origins
apps/codenames
apps/spyfall
apps/jeopardy     # Next UI + optional `scripts/buzzer-server.mjs`
packages/shared   # Shared helpers (`@minigames/shared`)
```
