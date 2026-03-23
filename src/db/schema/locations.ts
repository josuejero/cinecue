import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { appUsers } from "./auth";

export const locationKindEnum = pgEnum("location_kind", ["zip", "coordinates"]);

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    kind: locationKindEnum("kind").notNull().default("zip"),
    normalizedKey: text("normalized_key").notNull(),
    label: text("label"),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    radiusMiles: integer("radius_miles").notNull().default(25),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normalizedKeyUnique: uniqueIndex("locations_normalized_key_unique").on(table.normalizedKey),
  }),
);

export const userSavedLocations = pgTable(
  "user_saved_locations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    label: text("label"),
    isDefault: boolean("is_default").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    distanceOverrideMiles: integer("distance_override_miles"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLocationUnique: uniqueIndex("user_saved_locations_user_location_unique").on(
      table.userId,
      table.locationId,
    ),
    userDefaultIdx: index("user_saved_locations_user_default_idx").on(
      table.userId,
      table.isDefault,
    ),
    userDisplayOrderIdx: index("user_saved_locations_user_display_order_idx").on(
      table.userId,
      table.isDefault,
      table.displayOrder,
      table.createdAt,
    ),
  }),
);
