# Hub (Minigames entry)

## Local development

From the monorepo root:

```bash
npm install
npm run dev
```

This starts both apps in parallel:

```bash
npm run dev:hub       # Hub on port 3000
npm run dev:codenames # Codenames on port 3001
```

Configure local envs for seamless same-origin navigation (`/codenames` via hub):

```bash
# apps/hub/.env.local
NEXT_PUBLIC_CODENAMES_URL=
```

```bash
# apps/codenames/.env.local
NEXT_PUBLIC_BASE_PATH=/codenames
```

Then open [http://localhost:3000](http://localhost:3000). Joining Codenames routes to `http://localhost:3000/codenames?...` while the hub dev proxy forwards requests to Codenames on port `3001`.

Leave `NEXT_PUBLIC_CODENAMES_URL` unset in production on the hub when using path-based routing to Codenames on the same domain (see below).

## Vercel (two projects, one public URL)

1. **Codenames project** — Root Directory: `apps/codenames`. Set:
   - `NEXT_PUBLIC_BASE_PATH=/codenames`
2. **Hub project** — Root Directory: `apps/hub`. Connect your production domain here.
3. Edit [`vercel.json`](./vercel.json): replace `YOUR_CODENAMES_DEPLOYMENT` with your Codenames deployment hostname (no `https://` in the pattern — it is included in the JSON `destination` field as shown).
4. On the hub project, do **not** set `NEXT_PUBLIC_CODENAMES_URL` (or set it empty) so the hub builds links as `/codenames?lobby=...` and shares `localStorage` with the proxied Codenames app.

After deploy, confirm `/codenames/_next/static/...` loads in the browser Network tab.
