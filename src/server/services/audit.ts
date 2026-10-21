import type { DbOrTx } from "../db/client";
import { auditEvents } from "../db/schema";
import type { Realm } from "@/shared/types";

export type AuditInput = {
  realm: Realm;
  actorType: "pass" | "crew" | "system";
  actorId?: string | null;
  action: string;
  /** Ids and before/after values only — never photo bytes or personal data. */
  details?: Record<string, unknown>;
};

/** Append-only record of every vote and crew action (FR-027). */
export async function record(tx: DbOrTx, e: AuditInput): Promise<void> {
  await tx.insert(auditEvents).values({
    realm: e.realm,
    actorType: e.actorType,
    actorId: e.actorId ?? null,
    action: e.action,
    details: e.details ?? {},
  });
}
