import {
  pgTable,
  uuid,
  text,
  real,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Nonprofits ─────────────────────────────────────────────────

export const nonprofits = pgTable("nonprofits", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  city: text("city").notNull(),
  county: text("county").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  logoUrl: text("logo_url"),
  mission: text("mission"),
  donateUrl: text("donate_url"),
  confidence: real("confidence").default(0.5).notNull(),
  researchDepth: integer("research_depth").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Causes (28 categories) ────────────────────────────────────

export const causes = pgTable("causes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
  color: text("color").notNull().default("#22d3ee"),
  nonprofitCount: integer("nonprofit_count").default(0).notNull(),
});

// ─── Nonprofit <-> Cause join ──────────────────────────────────

export const nonprofitCauses = pgTable(
  "nonprofit_causes",
  {
    nonprofitId: uuid("nonprofit_id")
      .notNull()
      .references(() => nonprofits.id, { onDelete: "cascade" }),
    causeId: uuid("cause_id")
      .notNull()
      .references(() => causes.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.nonprofitId, t.causeId] }),
  })
);

// ─── Campaigns ─────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  nonprofitId: uuid("nonprofit_id")
    .notNull()
    .references(() => nonprofits.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Entity Cache (connectome ground truth) ────────────────────
// DB needs: CREATE UNIQUE INDEX entity_cache_name_type_unique ON entity_cache (entity_name, entity_type)

export const entityCache = pgTable("entity_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(),
  confidence: real("confidence").default(0.3).notNull(),
  mentionCount: integer("mention_count").default(1).notNull(),
  researchDepth: integer("research_depth").default(0).notNull(),
  genres: text("genres").array().default([]),
  locationCity: text("location_city"),
  locationCountry: text("location_country"),
  collaborators: text("collaborators").array().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  inferredFrom: jsonb("inferred_from")
    .$type<
      Array<{
        source: string;
        claim: string;
        confidence: number;
        timestamp: string;
      }>
    >()
    .default([]),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Engagement ────────────────────────────────────────────────

export const engagement = pgTable("engagement", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  nonprofitId: uuid("nonprofit_id").references(() => nonprofits.id),
  action: text("action").notNull(),
  durationSeconds: integer("duration_seconds").default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Predictions (connectome meta-learning feedback loop) ──────

export const predictions = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  nonprofitId: uuid("nonprofit_id")
    .notNull()
    .references(() => nonprofits.id),
  predictedScore: real("predicted_score").notNull(),
  signalContributions: jsonb("signal_contributions")
    .$type<Record<string, number>>()
    .default({}),
  outcomeDonated: boolean("outcome_donated"),
  outcomeExploredSeconds: integer("outcome_explored_seconds"),
  outcomeBookmarked: boolean("outcome_bookmarked"),
  outcomePhase: text("outcome_phase"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Visitor Sessions ──────────────────────────────────────────

export const visitorSessions = pgTable("visitor_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").unique().notNull(),
  ipHash: text("ip_hash"),
  cityInferred: text("city_inferred"),
  causesExplored: text("causes_explored").array().default([]),
  nonprofitsViewed: text("nonprofits_viewed").array().default([]),
  sessionDepth: integer("session_depth").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Watchlist Emails (March 31 reminder) ──────────────────────

export const watchlistEmails = pgTable("watchlist_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  nonprofitsBookmarked: text("nonprofits_bookmarked").array().default([]),
  reminded: boolean("reminded").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Inferred Types ────────────────────────────────────────────

export type Nonprofit = typeof nonprofits.$inferSelect;
export type Cause = typeof causes.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type EntityCache = typeof entityCache.$inferSelect;
export type Engagement = typeof engagement.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type VisitorSession = typeof visitorSessions.$inferSelect;
export type WatchlistEmail = typeof watchlistEmails.$inferSelect;
