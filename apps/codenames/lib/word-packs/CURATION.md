# Word pack curation rules

These guidelines keep cards fun to clue, safe to ship, and consistent with how boards are built (`mergeWordPool` + `generateBoard`).

## Format

- **Single token** per card: one unbroken string, no spaces. Prefer plain Latin letters `[a-z]` only so every player reads the same word.
- **Lowercase** in JSON files. The merge step normalizes to lowercase.
- **No duplicates inside a pack.** Duplicates across packs are removed when merging (first pack in definition order wins).

## Clueability

- Favor **concrete nouns** and familiar concepts a spymaster can connect with a one-word clue.
- Abstract words, very rare jargon, or ultra-niche proper nouns make the game harder; isolate those in optional packs (e.g. STEM) instead of the default pool.
- Avoid words that are **pure function words** or too vague alone unless the pack is explicitly a “hard mode” variant.

## Legal and sensitivity

- Avoid **trademarked names**, celebrity names, and current political figures. Prefer generic media terms (see the pop-culture pack).
- Packs marked `teen` or `mature` in code should stay clearly labeled in the host UI so groups can opt in consciously.

## Hygiene

- When adding a new pack, register it in `definitions.ts`, add the JSON under `packs/`, and wire it in `wordsByPack.ts`.
- After edits, run `pnpm build` / `npm run build` so TypeScript validates imports and duplicate checks in `wordsByPack.ts` run at module load.