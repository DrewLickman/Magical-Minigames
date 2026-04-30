# Jeopardy (host)

Host loads a JSON board, runs the clue flow on a projector, and optionally collects buzzes over the LAN.

## Party night (three steps)

1. From the **monorepo root**: `npm run dev:jeopardy:party` — starts the game UI and the buzzer WebSocket server together.
2. Open the **host** page using your laptop’s **Wi‑Fi address** when you can (e.g. `http://192.168.1.50:3003/jeopardy/host` or via the hub on that same host). If you must use `localhost`, the host screen will ask for your Wi‑Fi IP once before you copy links.
3. On the host lobby, tap **Copy link for players** and send that link to everyone. They open it, enter a name, and tap **Join**.

Direct host URL (Jeopardy app only): [http://localhost:3003/jeopardy/host](http://localhost:3003/jeopardy/host)

## Troubleshooting

- **Port already in use (`EADDRINUSE`)**: another process is using the buzzer port (default **8787**). Stop the old process or run with a different port, e.g. PowerShell: `$env:JEOPARDY_BUZZER_PORT=8788` before `npm run buzzer-server`, then set the same port under **Advanced** on the host and in invite links / buzzer page.
- **Override WebSocket URL**: set `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` (documented in env sections of the hub / deploy runbooks). Host **Advanced** explains when this is active.

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