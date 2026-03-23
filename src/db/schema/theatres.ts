import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sourceProviderEnum } from "./catalog";

export const theatres = pgTable(
  "theatres",
  {
    id: text("id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    chainName: text("chain_name"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    address1: text("address_1"),
    address2: text("address_2"),
    city: text("city"),
    state: text("state"),
    postalCode: varchar("postal_code", { length: 20 }),
    countryCode: varchar("country_code", { length: 3 }).notNull().default("USA"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    phone: text("phone"),
    timeZone: text("time_zone"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    identityKeyUnique: uniqueIndex("theatres_identity_key_unique").on(table.identityKey),
    postalCodeIdx: index("theatres_postal_code_idx").on(table.postalCode),
    normalizedNameIdx: index("theatres_normalized_name_idx").on(table.normalizedName),
  }),
);

export const theatreExternalIds = pgTable(
  "theatre_external_ids",
  {
    theatreId: text("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
    provider: sourceProviderEnum("provider").notNull(),
    externalType: text("external_type").notNull().default("theatreId"),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      name: "theatre_external_ids_pk",
      columns: [table.provider, table.externalType, table.externalId],
    }),
    theatreIdIdx: index("theatre_external_ids_theatre_id_idx").on(table.theatreId),
  }),
);
