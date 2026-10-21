// Tables and constraints per specs/001-costume-contest/data-model.md.
// No table holds a student name, contact detail, or free text typed by anyone.
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const realmEnum = pgEnum("realm", ["live", "rehearsal"]);
export const stageEnum = pgEnum("stage", [
  "setup",
  "voting_open",
  "voting_closed",
  "results_revealed",
]);
export const passOriginEnum = pgEnum("pass_origin", ["self", "crew"]);
export const voteStatusEnum = pgEnum("vote_status", ["counted", "voided", "released"]);
export const actorTypeEnum = pgEnum("actor_type", ["pass", "crew", "system"]);

export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey(),
    rehearsalMode: boolean("rehearsal_mode").notNull().default(false),
    eventStart: ts("event_start").notNull(),
    eventEnd: ts("event_end").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_window_order", sql`${t.eventEnd} > ${t.eventStart}`),
  ],
);

export const crewSessions = pgTable("crew_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceLabel: text("device_label").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
});

export const passes = pgTable(
  "passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    realm: realmEnum("realm").notNull(),
    tokenHash: bytea("token_hash"),
    nickname: text("nickname").notNull(),
    number: integer("number").notNull(),
    origin: passOriginEnum("origin").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdByCrewSessionId: uuid("created_by_crew_session_id").references(() => crewSessions.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("passes_realm_nickname").on(t.realm, t.nickname),
    uniqueIndex("passes_realm_number").on(t.realm, t.number),
    uniqueIndex("passes_token_hash").on(t.tokenHash),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    realm: realmEnum("realm").notNull(),
    photoId: uuid("photo_id").notNull(),
    consentConfirmedAt: ts("consent_confirmed_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    removedAt: ts("removed_at"),
  },
  (t) => [index("entries_realm").on(t.realm)],
);

export const entryPasses = pgTable(
  "entry_passes",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.passId] }), uniqueIndex("entry_passes_pass").on(t.passId)],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    realm: realmEnum("realm").notNull(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    status: voteStatusEnum("status").notNull().default("counted"),
    assistedByCrewSessionId: uuid("assisted_by_crew_session_id").references(
      () => crewSessions.id,
      { onDelete: "set null" },
    ),
    castAt: ts("cast_at").notNull().defaultNow(),
    statusChangedAt: ts("status_changed_at").notNull().defaultNow(),
    statusChangedByCrewSessionId: uuid("status_changed_by_crew_session_id").references(
      () => crewSessions.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    // One vote per pass (FR-009). A voided vote still uses up the pass; only `released` frees it.
    uniqueIndex("votes_one_per_pass")
      .on(t.passId)
      .where(sql`${t.status} in ('counted', 'voided')`),
    index("votes_realm_entry").on(t.realm, t.entryId),
  ],
);

export const contest = pgTable(
  "contest",
  {
    realm: realmEnum("realm").primaryKey(),
    stage: stageEnum("stage").notNull().default("setup"),
    revealStep: smallint("reveal_step").notNull().default(0),
    version: integer("version").notNull().default(0),
    entriesVersion: integer("entries_version").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("contest_reveal_step", sql`${t.revealStep} between 0 and 3`)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    realm: realmEnum("realm").notNull(),
    at: ts("at").notNull().defaultNow(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("audit_realm_at").on(t.realm, t.at)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: uuid("key").notNull(),
    scope: text("scope").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.key, t.scope] })],
);
