# Jeopardy (host)

Host loads a JSON board, runs the clue flow on a projector, and optionally collects buzzes over the LAN.

## Party night (four steps)

1. From the **monorepo root**: `npm run dev:jeopardy:party` — starts the game UI and the buzzer WebSocket server together.
2. Open the **host** page (`http://192.168.1.50:3003/jeopardy/host` or via hub).
3. Use **Copy contestant invite (room included)** in the host lobby and share that link with players.
4. If host opens on a Vercel/prod URL, the UI shows a compact local-run banner with a copyable local host URL template.

Direct host URL (Jeopardy app only): [http://localhost:3003/jeopardy/host](http://localhost:3003/jeopardy/host)

## Troubleshooting

- **Port already in use (`EADDRINUSE`)**: another process is using the buzzer port (default **8787**). Stop the old process or run with a different port, e.g. PowerShell: `$env:JEOPARDY_BUZZER_PORT=8788` before `npm run buzzer-server`.
- **Override WebSocket URL**: set `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` (documented in env sections of the hub / deploy runbooks). Host and buzzer clients both use it when present.
- **Start game is disabled**: the app attempts to load `public/jeopardy-template.json` by default. If template loading fails, import a board JSON manually.

## Local development (UI only)

```bash
npm run dev:jeopardy
```

Env (optional):

- `NEXT_PUBLIC_BASE_PATH=/jeopardy` (default)
- `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` — fixed WebSocket URL for host + buzzer clients

## Buzzer server only

If you are not using `dev:jeopardy:party`:

```bash
npm run buzzer-server --workspace=jeopardy
```

## Board JSON

See `public/jeopardy-template.json`. Five top-level category keys; each must include `"100"` … `"500"` with `question` and `answer` strings.