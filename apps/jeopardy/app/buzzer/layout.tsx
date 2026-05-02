import type { Viewport } from "next";
import type { ReactNode } from "react";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function BuzzerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-[var(--background)] [-webkit-tap-highlight-color:transparent] select-none [-webkit-touch-callout:none]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
