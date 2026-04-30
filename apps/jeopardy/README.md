# Jeopardy (host)

Host loads a JSON board, runs the clue flow on a projector, and optionally collects buzzes over the LAN.

## Party night (three steps)

1. From the **monorepo root**: `npm run dev:jeopardy:party` — starts the game UI and the buzzer WebSocket server together.
2. Open the **host** page (`http://192.168.1.50:3003/jeopardy/host` or via hub), then use **Copy contestant invite (room included)**. This link includes room + host + port so contestants usually do not type a room code.
3. Optional fallback: use the terminal line `**Share this link with the contestants: ...`** and then provide the room code shown in host lobby.

Direct host URL (Jeopardy app only): [http://localhost:3003/jeopardy/host](http://localhost:3003/jeopardy/host)

## Troubleshooting

- **Port already in use (`EADDRINUSE`)**: another process is using the buzzer port (default **8787**). Stop the old process or run with a different port, e.g. PowerShell: `$env:JEOPARDY_BUZZER_PORT=8788` before `npm run buzzer-server`, then set the same port under **Advanced** on the host and use the terminal-provided contestant link.
- **Override WebSocket URL**: set `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` (documented in env sections of the hub / deploy runbooks). Host **Advanced** explains when this is active.
- **Start game is disabled**: import a board JSON first (template at `public/jeopardy-template.json`). The lobby shows this reason inline when Start is disabled.

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