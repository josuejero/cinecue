import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  locations,
  showtimes,
  userFavoriteTheatres,
  userMovieFollows,
  userSavedLocations,
} from "@/db/schema";
import { normalizePostalCode } from "@/lib/normalize";
import { BadRequestError, NotFoundError } from "@/lib/phase2/errors";
import { hasPostgresErrorCode } from "@/lib/db-error-utils";

function createId() {
  return crypto.randomUUID();
}

function buildCoordinatesKey(latitude: number, longitude: number) {
  return `coords:${latitude}:${longitude}`;
}

function buildDefaultLocationLabel(input: {
  kind: "zip" | "coordinates";
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  if (input.kind === "zip") {
    return input.postalCode ? `ZIP ${input.postalCode}` : "Saved ZIP";
  }

  return `${input.latitude}, ${input.longitude}`;
}

function normalizeCoordinates(latitude: number, longitude: number) {
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

let ensureUserSavedLocationsSchemaPromise: Promise<void> | null = null;
let ensureUserFavoriteTheatresTablePromise: Promise<void> | null = null;

async function ensureUserSavedLocationsSchema() {
  if (!ensureUserSavedLocationsSchemaPromise) {
    ensureUserSavedLocationsSchemaPromise = (async () => {
      const db = getDb();
      const statements = [
        sql`ALTER TABLE "user_saved_locations" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`,
        sql`ALTER TABLE "user_saved_locations" ADD COLUMN IF NOT EXISTS "distance_override_miles" integer`,
        sql`ALTER TABLE "user_saved_locations" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp with time zone`,
      ];

      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          for (const statement of statements) {
            await db.execute(statement);
          }
          return;
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    })();
  }

  try {
    await ensureUserSavedLocationsSchemaPromise;
  } catch (error) {
    ensureUserSavedLocationsSchemaPromise = null;
    throw error;
  }
}

async function ensureUserFavoriteTheatresTable() {
  if (!ensureUserFavoriteTheatresTablePromise) {
    ensureUserFavoriteTheatresTablePromise = (async () => {
      const db = getDb();
      const tableStatement = sql`
        CREATE TABLE IF NOT EXISTS "user_favorite_theatres" (
          "id" text PRIMARY KEY NOT NULL,
          "user_id" text NOT NULL,
          "location_id" text NOT NULL,
          "theatre_id" text NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `;
      const constraintStatements = [
        sql`
          ALTER TABLE "user_favorite_theatres"
          ADD CONSTRAINT "user_favorite_theatres_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
        `,
        sql`
          ALTER TABLE "user_favorite_theatres"
          ADD CONSTRAINT "user_favorite_theatres_location_id_locations_id_fk"
          FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action
        `,
        sql`
          ALTER TABLE "user_favorite_theatres"
          ADD CONSTRAINT "user_favorite_theatres_theatre_id_theatres_id_fk"
          FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action
        `,
      ];
      const indexStatements = [
        sql`
          CREATE UNIQUE INDEX IF NOT EXISTS "user_favorite_theatres_user_location_theatre_unique"
          ON "user_favorite_theatres" USING btree ("user_id","location_id","theatre_id")
        `,
        sql`
          CREATE INDEX IF NOT EXISTS "user_favorite_theatres_user_location_idx"
          ON "user_favorite_theatres" USING btree ("user_id","location_id")
        `,
      ];

      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await db.execute(tableStatement);
          for (const statement of constraintStatements) {
            try {
              await db.execute(statement);
            } catch (error) {
              if (!hasPostgresErrorCode(error, "42710")) {
                throw error;
              }
            }
          }
          for (const statement of indexStatements) {
            await db.execute(statement);
          }
          return;
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    })();
  }

  try {
    await ensureUserFavoriteTheatresTablePromise;
  } catch (error) {
    ensureUserFavoriteTheatresTablePromise = null;
    throw error;
  }
}

async function ensureTheatreBelongsToLocation(locationId: string, theatreId: string) {
  const db = getDb();
  const [row] = await db
    .select({ theatreId: showtimes.theatreId })
    .from(showtimes)
    .where(
      and(eq(showtimes.locationId, locationId), eq(showtimes.theatreId, theatreId)),
    )
    .limit(1);

  if (!row) {
    throw new BadRequestError("Theatre is not available for the selected location.");
  }
}

export async function ensureUserOwnsSavedLocation(userId: string, locationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: userSavedLocations.id })
    .from(userSavedLocations)
    .where(
      and(
        eq(userSavedLocations.userId, userId),
        eq(userSavedLocations.locationId, locationId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError("Saved location not found.");
  }
}

export async function listUserSavedLocations(userId: string) {
  await ensureUserSavedLocationsSchema();
  const db = getDb();

  const rows = await db
    .select({
      userLocationId: userSavedLocations.id,
      locationId: locations.id,
      normalizedKey: locations.normalizedKey,
      postalCode: locations.postalCode,
      radiusMiles: locations.radiusMiles,
      globalLabel: locations.label,
      userLabel: userSavedLocations.label,
      isDefault: userSavedLocations.isDefault,
      displayOrder: userSavedLocations.displayOrder,
      distanceOverrideMiles: userSavedLocations.distanceOverrideMiles,
      lastUsedAt: userSavedLocations.lastUsedAt,
      kind: locations.kind,
      latitude: locations.latitude,
      longitude: locations.longitude,
      createdAt: userSavedLocations.createdAt,
    })
    .from(userSavedLocations)
    .innerJoin(locations, eq(userSavedLocations.locationId, locations.id))
    .where(eq(userSavedLocations.userId, userId))
    .orderBy(
      desc(userSavedLocations.isDefault),
      asc(userSavedLocations.displayOrder),
      asc(userSavedLocations.createdAt),
    );

  const locationIds = rows.map((row) => row.locationId);

  const followCounts = locationIds.length
    ? await db
        .select({
          locationId: userMovieFollows.locationId,
          count: sql<number>`count(*)`,
        })
        .from(userMovieFollows)
        .where(
          and(
            eq(userMovieFollows.userId, userId),
            inArray(userMovieFollows.locationId, locationIds),
          ),
        )
        .groupBy(userMovieFollows.locationId)
    : [];

  const favoriteCounts = locationIds.length
    ? await (async () => {
        await ensureUserFavoriteTheatresTable();
        return db
          .select({
            locationId: userFavoriteTheatres.locationId,
            count: sql<number>`count(*)`,
          })
          .from(userFavoriteTheatres)
          .where(
            and(
              eq(userFavoriteTheatres.userId, userId),
              inArray(userFavoriteTheatres.locationId, locationIds),
            ),
          )
          .groupBy(userFavoriteTheatres.locationId);
      })()
    : [];

  const followCountByLocation = new Map(
    followCounts.map((row) => [row.locationId, Number(row.count)]),
  );
  const favoriteCountByLocation = new Map(
    favoriteCounts.map((row) => [row.locationId, Number(row.count)]),
  );

  return rows.map((row) => ({
    userLocationId: row.userLocationId,
    locationId: row.locationId,
    normalizedKey: row.normalizedKey,
    postalCode: row.postalCode ?? null,
    radiusMiles: row.radiusMiles,
    label:
      row.userLabel ?? row.globalLabel ?? row.postalCode ?? row.normalizedKey,
    isDefault: row.isDefault,
    displayOrder: row.displayOrder,
    distanceOverrideMiles: row.distanceOverrideMiles ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    kind: row.kind,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    createdAt: row.createdAt,
    followCount: followCountByLocation.get(row.locationId) ?? 0,
    favoriteTheatreCount: favoriteCountByLocation.get(row.locationId) ?? 0,
  }));
}

export async function createSavedLocationForUser(input: {
  userId: string;
  label?: string | null;
  postalCode?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMiles?: number | null;
  makeDefault?: boolean;
}) {
  await ensureUserSavedLocationsSchema();
  const db = getDb();
  const radiusMiles = input.radiusMiles ?? 25;
  const requestedPostalCode = input.postalCode ?? input.zip ?? null;

  let normalizedKey: string;
  let kind: "zip" | "coordinates";
  let postalCode: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (requestedPostalCode) {
    postalCode = normalizePostalCode(requestedPostalCode);

    if (!postalCode) {
      throw new BadRequestError("A valid ZIP or postal code is required.");
    }

    normalizedKey = `zip:${postalCode}`;
    kind = "zip";
  } else if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    const normalized = normalizeCoordinates(input.latitude, input.longitude);
    latitude = normalized.latitude;
    longitude = normalized.longitude;
    normalizedKey = buildCoordinatesKey(latitude, longitude);
    kind = "coordinates";
  } else {
    throw new BadRequestError("Provide a postalCode or latitude/longitude.");
  }

  const globalLabel = buildDefaultLocationLabel({
    kind,
    postalCode,
    latitude,
    longitude,
  });

  await db
    .insert(locations)
    .values({
      id: createId(),
      kind,
      normalizedKey,
      label: globalLabel,
      postalCode,
      latitude,
      longitude,
      radiusMiles,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: locations.normalizedKey,
    });

  const [location] = await db
    .select({
      id: locations.id,
      radiusMiles: locations.radiusMiles,
      postalCode: locations.postalCode,
      normalizedKey: locations.normalizedKey,
      label: locations.label,
    })
    .from(locations)
    .where(eq(locations.normalizedKey, normalizedKey))
    .limit(1);

  if (!location) {
    throw new Error("Failed to create or load the requested location.");
  }

  const existingSavedLocations = await listUserSavedLocations(input.userId);
  const existingLink = existingSavedLocations.find(
    (savedLocation) => savedLocation.locationId === location.id,
  );
  const shouldBeDefault =
    input.makeDefault ??
    (existingSavedLocations.length === 0 || existingLink?.isDefault === true);
  const displayOrder = existingLink?.displayOrder ?? existingSavedLocations.length;
  const trimmedLabel = input.label?.trim() || null;

  await db
    .insert(userSavedLocations)
    .values({
      id: createId(),
      userId: input.userId,
      locationId: location.id,
      label: trimmedLabel,
      isDefault: false,
      displayOrder,
      distanceOverrideMiles: radiusMiles,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userSavedLocations.userId, userSavedLocations.locationId],
      set: {
        label: trimmedLabel,
        displayOrder,
        distanceOverrideMiles: radiusMiles,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  if (shouldBeDefault) {
    await setDefaultSavedLocation(input.userId, location.id);
  }

  return location.id;
}

export async function setDefaultSavedLocation(userId: string, locationId: string) {
  await ensureUserSavedLocationsSchema();
  const db = getDb();
  await ensureUserOwnsSavedLocation(userId, locationId);

  await db
    .update(userSavedLocations)
    .set({
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(userSavedLocations.userId, userId));

  await db
    .update(userSavedLocations)
    .set({
      isDefault: true,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSavedLocations.userId, userId),
        eq(userSavedLocations.locationId, locationId),
      ),
    );
}

export async function markLocationUsed(userId: string, locationId: string) {
  await ensureUserSavedLocationsSchema();
  const db = getDb();

  await db
    .update(userSavedLocations)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSavedLocations.userId, userId),
        eq(userSavedLocations.locationId, locationId),
      ),
    );
}

export async function listFavoriteTheatreIds(userId: string, locationId: string) {
  await ensureUserFavoriteTheatresTable();
  const db = getDb();
  const rows = await db
    .select({ theatreId: userFavoriteTheatres.theatreId })
    .from(userFavoriteTheatres)
    .where(
      and(
        eq(userFavoriteTheatres.userId, userId),
        eq(userFavoriteTheatres.locationId, locationId),
      ),
    );

  return rows.map((row) => row.theatreId);
}

export async function addFavoriteTheatre(input: {
  userId: string;
  locationId: string;
  theatreId: string;
}) {
  await ensureUserFavoriteTheatresTable();
  const db = getDb();
  await ensureUserOwnsSavedLocation(input.userId, input.locationId);
  await ensureTheatreBelongsToLocation(input.locationId, input.theatreId);

  await db
    .insert(userFavoriteTheatres)
    .values({
      id: createId(),
      userId: input.userId,
      locationId: input.locationId,
      theatreId: input.theatreId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        userFavoriteTheatres.userId,
        userFavoriteTheatres.locationId,
        userFavoriteTheatres.theatreId,
      ],
    });
}

export async function removeFavoriteTheatre(input: {
  userId: string;
  locationId: string;
  theatreId: string;
}) {
  await ensureUserFavoriteTheatresTable();
  const db = getDb();
  await ensureUserOwnsSavedLocation(input.userId, input.locationId);

  await db
    .delete(userFavoriteTheatres)
    .where(
      and(
        eq(userFavoriteTheatres.userId, input.userId),
        eq(userFavoriteTheatres.locationId, input.locationId),
        eq(userFavoriteTheatres.theatreId, input.theatreId),
      ),
    );
}
