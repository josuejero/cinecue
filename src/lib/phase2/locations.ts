import { getDb } from "@/db/client";
import { locations, userSavedLocations } from "@/db/schema";
import { normalizePostalCode } from "@/lib/normalize";
import { and, asc, desc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { BadRequestError, NotFoundError } from "./errors";

function createId() {
  return crypto.randomUUID();
}

function buildLocationKey(zip: string) {
  return `zip:${zip}`;
}

export type ResolvedUserLocation = {
  userLocationId: string;
  locationId: string;
  normalizedKey: string;
  postalCode: string | null;
  radiusMiles: number;
  label: string;
  isDefault: boolean;
};

export async function getOrCreateZipLocation(input: {
  zip: string;
  radiusMiles?: number;
  label?: string;
}) {
  const db = getDb();
  const normalizedZip = normalizePostalCode(input.zip);

  if (!normalizedZip) {
    throw new BadRequestError("A valid ZIP or postal code is required.");
  }

  const normalizedKey = buildLocationKey(normalizedZip);
  const label = input.label?.trim() || `ZIP ${normalizedZip}`;

  await db
    .insert(locations)
    .values({
      id: createId(),
      kind: "zip",
      normalizedKey,
      label,
      postalCode: normalizedZip,
      radiusMiles: input.radiusMiles ?? 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: locations.normalizedKey,
      set: {
        label,
        postalCode: normalizedZip,
        radiusMiles: input.radiusMiles ?? 25,
        updatedAt: new Date(),
      },
    });

  const [location] = await db
    .select()
    .from(locations)
    .where(eq(locations.normalizedKey, normalizedKey))
    .limit(1);

  if (!location) {
    throw new BadRequestError("Failed to save the requested location.");
  }

  return location;
}

export async function getUserSavedLocations(userId: string): Promise<ResolvedUserLocation[]> {
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
      createdAt: userSavedLocations.createdAt,
    })
    .from(userSavedLocations)
    .innerJoin(locations, eq(userSavedLocations.locationId, locations.id))
    .where(eq(userSavedLocations.userId, userId))
    .orderBy(desc(userSavedLocations.isDefault), asc(userSavedLocations.createdAt));

  return rows.map((row) => ({
    userLocationId: row.userLocationId,
    locationId: row.locationId,
    normalizedKey: row.normalizedKey,
    postalCode: row.postalCode ?? null,
    radiusMiles: row.radiusMiles,
    label:
      row.userLabel ??
      row.globalLabel ??
      row.postalCode ??
      row.normalizedKey,
    isDefault: row.isDefault,
  }));
}

export async function saveUserLocation(
  userId: string,
  input: {
    zip: string;
    radiusMiles?: number;
    label?: string;
    makeDefault?: boolean;
  },
) {
  const db = getDb();
  const location = await getOrCreateZipLocation(input);
  const existingSavedLocations = await getUserSavedLocations(userId);
  const existingLink = existingSavedLocations.find(
    (item) => item.locationId === location.id,
  );

  const shouldBeDefault =
    input.makeDefault ?? (existingSavedLocations.length === 0 || existingLink?.isDefault === true);

  if (shouldBeDefault) {
    await db
      .update(userSavedLocations)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(eq(userSavedLocations.userId, userId));
  }

  await db
    .insert(userSavedLocations)
    .values({
      id: createId(),
      userId,
      locationId: location.id,
      label: input.label?.trim() || existingLink?.label || location.label || null,
      isDefault: shouldBeDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userSavedLocations.userId, userSavedLocations.locationId],
      set: {
        label: input.label?.trim() || existingLink?.label || location.label || null,
        isDefault: shouldBeDefault,
        updatedAt: new Date(),
      },
    });

  return resolveUserLocation(userId, location.id);
}

export async function setDefaultUserLocation(userId: string, locationId: string) {
  const db = getDb();
  const savedLocations = await getUserSavedLocations(userId);
  const match = savedLocations.find((item) => item.locationId === locationId);

  if (!match) {
    throw new NotFoundError("Saved location not found.");
  }

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
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSavedLocations.userId, userId),
        eq(userSavedLocations.locationId, locationId),
      ),
    );

  return resolveUserLocation(userId, locationId);
}

export async function resolveUserLocation(
  userId: string,
  requestedLocationId?: string | null,
): Promise<ResolvedUserLocation> {
  const savedLocations = await getUserSavedLocations(userId);

  if (savedLocations.length === 0) {
    throw new BadRequestError("Save a ZIP code before using follow and dashboard endpoints.");
  }

  if (requestedLocationId) {
    const match = savedLocations.find((item) => item.locationId === requestedLocationId);

    if (!match) {
      throw new NotFoundError("Saved location not found.");
    }

    return match;
  }

  return savedLocations.find((item) => item.isDefault) ?? savedLocations[0];
}