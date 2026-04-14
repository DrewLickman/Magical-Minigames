import { Suspense } from "react";
import { GameClient } from "./GameClient";

type PageParams = { seed: string };

export default async function GamePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { seed } = await params;
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-[var(--muted,currentColor)]">
          Loading…
        </div>
      }
    >
      <GameClient encodedSeed={seed} />
    </Suspense>
  );
}
