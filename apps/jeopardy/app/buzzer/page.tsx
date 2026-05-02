import { Suspense } from "react";
import { BuzzerClient } from "./BuzzerClient";

export default function BuzzerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
          Loading buzzer…
        </div>
      }
    >
      <BuzzerClient />
    </Suspense>
  );
}
