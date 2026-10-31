"use client";
import { useEffect, useState } from "react";
import { isEventOver } from "@/lib/nextEvent";

/**
 * Shows its children until `endsAt`, then hides them in the visitor's browser (spec 004 FR-306),
 * so a past event disappears without anyone republishing. The exported HTML always includes the
 * children; the copy is dated, so it still reads correctly with scripts off (FR-307).
 */
export function NextEventGate({ endsAt, children }: { endsAt: string; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const check = () => setOver(isEventOver(endsAt, Date.now()));
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [endsAt]);
  return over ? null : <>{children}</>;
}
