"use client";
import { createContext, useContext } from "react";
import type { PublicState } from "@/shared/types";

export type Dashboard = {
  state: PublicState;
  totals: { passes: number; votesCounted: number };
  screenUrl: string;
  deviceLabel: string;
};

export const CrewContext = createContext<{ dashboard: Dashboard; refresh: () => void } | null>(null);

export function useCrew() {
  const ctx = useContext(CrewContext);
  if (!ctx) throw new Error("useCrew outside crew layout");
  return ctx;
}
