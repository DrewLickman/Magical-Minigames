# Jeopardy (host)

Host loads a JSON board, runs the clue flow on a projector, and optionally collects buzzes over the LAN.

**Buzzer signatures:** each player enters a display name, draws a signature on the canvas, then taps **Ready** (connection is never automatic while typing). PNG signatures are sent to the buzzer server and shown on the host as a **bottom row of thumbnails** with scores; during **Answer**, the host taps a thumbnail to award points.

## Party night (four steps)

1. From the **monorepo root**: `npm run dev:jeopardy:party` — starts the game UI and the buzzer WebSocket server together.
2. Open the **host** page (`http://192.168.1.50:3003/jeopardy/host` or via hub).
3. Use **Copy contestant invite (room included)** in the host lobby and share that link with players.
4. If host opens on a Vercel/prod URL, the UI shows a compact local-run banner with a copyable local host URL template.

Direct host URL (Jeopardy app only): [http://localhost:3003/jeopardy/host](http://localhost:3003/jeopardy/host)

## Troubleshooting

- **Port already in use (`EADDRINUSE`)**: another process is using the buzzer port (default **8787**). Stop the old process or run with a different port, e.g. PowerShell: `$env:JEOPARDY_BUZZER_PORT=8788` before `npm run buzzer-server`.
- **Override WebSocket URL**: set `NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL` (documented in env sections of the hub / deploy runbooks). Host and buzzer clients both use it when present.
- **Start game is disabled**: the app attempts to load `public/jeopardy-template.json` (round 1: **$200–$1000** rows) by default. If template loading fails, import a board JSON manually.
- **Signature rejected on Ready**: the server enforces a maximum PNG payload size; use **Clear** and draw a simpler signature, then try again.

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

See `public/jeopardy-template.json` (round 1) and `public/jeopardy-template-round2.json` (round 2). Use **five** top-level category keys. Under each category, use **exactly five** numeric dollar keys (strings like `"200"`), the **same five keys in every category**, sorted low to high. Each cell is an object with `question` and `answer` strings.

Default ladders: round 1 uses **200 / 400 / 600 / 800 / 1000**; round 2 uses **400 / 800 / 1200 / 1600 / 2000**.

**Round Two (host):** while playing round 1, after all 25 cells are used and you return to the board view, a **Round Two** button appears above the contestant strip. It loads the staged round-2 board (from `jeopardy-template-round2.json` or **Import round 2 JSON** in the lobby). Only the **active** board is saved in this browser’s persisted host state; a custom imported round-2 file is not persisted and must be re-imported after a full reload if needed.

## Final Jeopardy

Clue data lives in `public/final-jeopardy-template.json` (`category`, `question`, `answer`). The host lobby can **Download Final Jeopardy template** or **Import Final Jeopardy JSON**. After **round 2** is finished (all 25 cells played, board view), **Final Jeopardy** starts the endgame.

**Flow:** Host sends wagers caps from each contestant’s current score; buzzers submit a wager (with confirm), then the host reveals the clue and a **30s** timer runs. Buzzers type a response (confirm + submit, or auto-submit when time expires). The host grades each contestant from the signature strip (wager and response hidden until that player is selected), applies correct (+wager) or incorrect (−wager), then **Reveal winner** shows everyone tied for the highest score. **Lobby** clears Final Jeopardy state; the buzzer server clears its Final Jeopardy room state when the host disconnects.

**WebSocket messages (in addition to existing buzzer protocol):** host → server `finalJeopardyStart` (category, maxWagers), `finalJeopardyRevealQuestion` (question, answerEndsAt), `finalJeopardyCloseAnswers`; buzzer → server `finalJeopardyWager`, `finalJeopardyAnswer`; server → host `finalJeopardyWagerPlaced` (playerId, name, no amount), `finalJeopardyGradingBundle` (wagers, answers); server → buzzer `finalJeopardyWagerPrompt`, `finalJeopardyQuestion`, `finalJeopardyAnswerPhaseEnded`.