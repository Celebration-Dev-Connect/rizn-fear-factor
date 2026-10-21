import type { Realm } from "@/shared/types";

declare global {
  namespace Express {
    interface Request {
      realm: Realm;
      pass?: { id: string; realm: Realm; nickname: string; number: number; origin: "self" | "crew"; createdAt: Date };
      crew?: { id: string; deviceLabel: string };
      screen?: true;
      /** Who the idempotency key is scoped to (pass id or crew session id). */
      actorScope?: string;
    }
  }
}

export {};
