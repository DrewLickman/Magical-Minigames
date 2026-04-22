# Hub (Minigames entry)

## Local development

From the monorepo root:

```bash
npm install
npm run dev
```

This starts all apps in parallel:

```bash
npm run dev:hub       # Hub on port 3000
npm run dev:codenames # Codenames on port 3001
npm run dev:spyfall   # Spyfall on port 3002
```

Configure local envs for seamless same-origin navigation (`/codenames` and `/spyfall` via hub):

```bash
# apps/hub/.env.local
CODENAMES_DEV_ORIGIN=http://localhost:3001
SPYFALL_DEV_ORIGIN=http://localhost:3002
```

```bash
# apps/codenames/.env.local
NEXT_PUBLIC_BASE_PATH=/codenames
```

```bash
# apps/spyfall/.env.local
NEXT_PUBLIC_BASE_PATH=/spyfall
```

Then open [http://localhost:3000](http://localhost:3000). Joining routes to same-origin paths (`/codenames` and `/spyfall`) while the hub dev proxy forwards requests to app-specific dev servers.

## Vercel (three projects, one public hub URL)

1. **Hub project** — Root Directory: `apps/hub`.
2. **Codenames project** — Root Directory: `apps/codenames`. Set:
   - `NEXT_PUBLIC_BASE_PATH=/codenames`
3. **Spyfall project** — Root Directory: `apps/spyfall`. Set:
   - `NEXT_PUBLIC_BASE_PATH=/spyfall`
4. On the **Hub** project, set:
   - `CODENAMES_PROD_ORIGIN=https://<codenames-production-domain>`
   - `SPYFALL_PROD_ORIGIN=https://<spyfall-production-domain>`

Routing mode is now always same-origin from Hub:
- Join links are generated as `/codenames?...` or `/spyfall?...`.
- Hub rewrites those routes to the configured production origins.

See [`docs/vercel-deployments.md`](../../docs/vercel-deployments.md) for the runbook and smoke-test checklist.
