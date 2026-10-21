"use client";
import { createContext, useContext } from "react";
import { usePoll, STUDENT_POLL, CREW_POLL } from "@/lib/usePoll";
import { usePathname } from "next/navigation";
import type { PublicState } from "@/shared/types";

type Ctx = { state: PublicState | undefined; refresh: () => void };
const StateContext = createContext<Ctx>({ state: undefined, refresh: () => {} });

/** One shared poll of /api/state per page. Crew and the big screen poll faster (research §3). */
export function StateProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const fast = path.startsWith("/crew") || path.startsWith("/screen");
  const { data, refresh } = usePoll<PublicState>("/api/state", fast ? CREW_POLL : STUDENT_POLL);
  return <StateContext.Provider value={{ state: data, refresh }}>{children}</StateContext.Provider>;
}

export function usePublicState(): Ctx {
  return useContext(StateContext);
}
