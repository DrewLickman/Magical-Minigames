# Codenames (web companion)

A small [Next.js](https://nextjs.org) app that helps you play **Codenames** in the same room: one shared **lobby code** produces the same 5×5 word grid for everyone, while **host** and **spymaster** views stay separate on each device.

## About the game

**Codenames** is a team word-guessing game for two sides (traditionally red and blue). A 5×5 grid shows 25 words. Before play, each word is secretly assigned a color: agents for one team, agents for the other, innocent bystanders (neutral), or a single **assassin** card that ends the round badly if it is revealed.

Each turn, one **spymaster** gives their field team a clue as **one word** and a **number**. The number is how many words on the grid relate to that clue. The field team discusses and touches cards to guess; they must guess **at least once** and may guess **up to the number plus one** time on that turn (the extra guess can recover from earlier misses). When a card is revealed, its color is shown. The first team to reveal all of its agent cards wins. Revealing the assassin typically loses the game for that team.

This app does not replace the social parts of the game—you still give clues and talk in person—but it handles the **board**, **roles**, and **reveals** so phones or a shared screen can stand in for physical cards.

## What this project does

- **Lobbies:** Pick any text **lobby code** (e.g. `living-room-7`). The same code always generates the same 25 words and the same hidden layout, using a deterministic seed (`lib/generateBoard.ts`).
- **Roles** (chosen on the home page):
  - **Host** — sees words as plain text until a card is revealed; taps once to **stage** a guess and again to **confirm** the reveal. Shows scores (9 red / 8 blue agents in this layout) and optional **turn timers** (60 seconds per side).
  - **Red Spymaster** / **Blue Spymaster** — see the full key (all card colors) without revealing them to the host view; guesses are still marked on the host device.
- **State:** Reveals and staging are stored in **localStorage** per lobby on each browser (`lib/boardStorage.ts`). There is no server-side game state—devices stay in sync by sharing the lobby link and playing together.
- **Sharing:** **Copy lobby link** sends the current URL; optional `?lobby=` on the home page can pre-fill the code. **Next game** advances to a new derived lobby code and clears board state on this device.

Stack: **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter a lobby code, choose **Host** or a spymaster role, then open the same lobby on other devices as needed.

```bash
npm run build   # production build
npm run start   # run production server
npm run lint    # ESLint
```

## Deploy

You can deploy like any Next.js app, for example on [Vercel](https://vercel.com). See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for details.
