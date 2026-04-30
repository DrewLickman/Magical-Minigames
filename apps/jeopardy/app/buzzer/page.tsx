import { Suspense } from "react";
import { BuzzerClient } from "./BuzzerClient";

export default function BuzzerPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-[var(--muted)]">Loading buzzer…</p>
      }
    >
      <BuzzerClient />
    </Suspense>
  );
}
