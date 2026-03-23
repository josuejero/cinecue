import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { appUsers } from "./auth";
import { movies } from "./catalog";
import { locations } from "./locations";
import { theatres } from "./theatres";

export const userMovieFollows = pgTable(
  "user_movie_follows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userMovieLocationUnique: uniqueIndex("user_movie_follows_user_movie_location_unique").on(
      table.userId,
      table.movieId,
      table.locationId,
    ),
    userLocationIdx: index("user_movie_follows_user_location_idx").on(
      table.userId,
      table.locationId,
    ),
    movieLocationIdx: index("user_movie_follows_movie_location_idx").on(
      table.movieId,
      table.locationId,
    ),
  }),
);

export const userFavoriteTheatres = pgTable(
  "user_favorite_theatres",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    theatreId: text("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLocationTheatreUnique: uniqueIndex(
      "user_favorite_theatres_user_location_theatre_unique",
    ).on(table.userId, table.locationId, table.theatreId),
    userLocationIdx: index("user_favorite_theatres_user_location_idx").on(
      table.userId,
      table.locationId,
    ),
  }),
);
