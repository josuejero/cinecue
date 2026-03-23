import crypto from "node:crypto";
import { getDb } from "@/db/client";
import { availabilityChangeEvents } from "@/db/schema";

export type AvailabilityStatus =
  | "now_playing"
  | "advance_tickets"
  | "coming_soon"
  | "no_local_schedule_yet"
  | "stopped_playing";

export type AvailabilityState = {
  status: AvailabilityStatus;
  nextShowingAt: Date | null;
  firstShowingAt: Date | null;
  lastShowingAt: Date | null;
  theatreCount: number;
};

export type AvailabilityEventKind =
  | "status_changed"
  | "newly_scheduled"
  | "now_playing"
  | "advance_tickets"
  | "stopped_playing"
  | "theatre_count_increased"
  | "final_showing_soon";

export type AvailabilityEventRecord = {
  id: string;
  eventKey: string;
  eventKind: AvailabilityEventKind;
  movieId: string;
  locationId: string;
  previousStatus: AvailabilityStatus | null;
  newStatus: AvailabilityStatus;
  previousTheatreCount: number | null;
  newTheatreCount: number;
  previousNextShowingAt: Date | null;
  newNextShowingAt: Date | null;
  changedAt: Date;
  metadata: Record<string, unknown>;
  sourceSyncRunId: string | null;
  suppressedAt: Date | null;
  suppressionReason: string | null;
};

function createId() {
  return crypto.randomUUID();
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : "none";
}

function sameTimestamp(left?: Date | null, right?: Date | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

function createEvent(input: {
  kind: AvailabilityEventKind;
  eventKey: string;
  movieId: string;
  locationId: string;
  previous: AvailabilityState;
  current: AvailabilityState;
  changedAt: Date;
  metadata?: Record<string, unknown>;
  sourceSyncRunId?: string | null;
}): AvailabilityEventRecord {
  return {
    id: createId(),
    eventKey: input.eventKey,
    eventKind: input.kind,
    movieId: input.movieId,
    locationId: input.locationId,
    previousStatus: input.previous.status,
    newStatus: input.current.status,
    previousTheatreCount: input.previous.theatreCount,
    newTheatreCount: input.current.theatreCount,
    previousNextShowingAt: input.previous.nextShowingAt,
    newNextShowingAt: input.current.nextShowingAt,
    changedAt: input.changedAt,
    metadata: input.metadata ?? {},
    sourceSyncRunId: input.sourceSyncRunId ?? null,
    suppressedAt: null,
    suppressionReason: null,
  };
}

export function buildAvailabilityEvents(input: {
  movieId: string;
  locationId: string;
  previous: AvailabilityState | null;
  current: AvailabilityState;
  currentBusinessDate: string;
  finalShowingSoonHours: number;
  sourceSyncRunId?: string | null;
  now?: Date;
}) {
  const previous = input.previous;

  if (!previous) {
    return [] as AvailabilityEventRecord[];
  }

  const changedAt = input.now ?? new Date();
  const events = new Map<string, AvailabilityEventRecord>();

  const statusChanged = previous.status !== input.current.status;
  const theatreCountChanged = previous.theatreCount !== input.current.theatreCount;
  const nextShowingChanged = !sameTimestamp(
    previous.nextShowingAt,
    input.current.nextShowingAt,
  );
  const lastShowingChanged = !sameTimestamp(
    previous.lastShowingAt,
    input.current.lastShowingAt,
  );

  const push = (event: AvailabilityEventRecord) => {
    if (!events.has(event.eventKey)) {
      events.set(event.eventKey, event);
    }
  };

  if (statusChanged || theatreCountChanged || nextShowingChanged) {
    push(
      createEvent({
        kind: "status_changed",
        eventKey: [
          "status_changed",
          input.movieId,
          input.locationId,
          previous.status ?? "none",
          input.current.status,
          input.current.theatreCount,
          toIso(input.current.nextShowingAt),
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
        metadata: {
          statusChanged,
          theatreCountChanged,
          nextShowingChanged,
        },
      }),
    );
  }

  if (
    (previous.status === "no_local_schedule_yet" ||
      previous.status === "coming_soon" ||
      previous.status === "stopped_playing") &&
    (input.current.status === "advance_tickets" || input.current.status === "now_playing") &&
    input.current.nextShowingAt
  ) {
    push(
      createEvent({
        kind: "newly_scheduled",
        eventKey: [
          "newly_scheduled",
          input.movieId,
          input.locationId,
          toIso(input.current.nextShowingAt),
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
      }),
    );
  }

  if (
    previous.status !== "advance_tickets" &&
    input.current.status === "advance_tickets" &&
    input.current.nextShowingAt
  ) {
    push(
      createEvent({
        kind: "advance_tickets",
        eventKey: [
          "advance_tickets",
          input.movieId,
          input.locationId,
          toIso(input.current.nextShowingAt),
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
      }),
    );
  }

  if (
    previous.status !== "now_playing" &&
    input.current.status === "now_playing" &&
    input.current.nextShowingAt
  ) {
    push(
      createEvent({
        kind: "now_playing",
        eventKey: [
          "now_playing",
          input.movieId,
          input.locationId,
          input.currentBusinessDate,
          toIso(input.current.nextShowingAt),
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
      }),
    );
  }

  if (previous.status !== "stopped_playing" && input.current.status === "stopped_playing") {
    push(
      createEvent({
        kind: "stopped_playing",
        eventKey: [
          "stopped_playing",
          input.movieId,
          input.locationId,
          input.currentBusinessDate,
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
      }),
    );
  }

  if (input.current.theatreCount > previous.theatreCount && input.current.theatreCount > 0) {
    push(
      createEvent({
        kind: "theatre_count_increased",
        eventKey: [
          "theatre_count_increased",
          input.movieId,
          input.locationId,
          input.current.theatreCount,
          toIso(input.current.nextShowingAt),
        ].join(":"),
        movieId: input.movieId,
        locationId: input.locationId,
        previous,
        current: input.current,
        changedAt,
        sourceSyncRunId: input.sourceSyncRunId,
        metadata: {
          previousTheatreCount: previous.theatreCount,
          newTheatreCount: input.current.theatreCount,
        },
      }),
    );
  }

  if (input.current.lastShowingAt && input.current.status !== "stopped_playing") {
    const thresholdMs = input.finalShowingSoonHours * 60 * 60 * 1000;
    const remainingMs = input.current.lastShowingAt.getTime() - changedAt.getTime();
    const previousRemainingMs = previous.lastShowingAt
      ? previous.lastShowingAt.getTime() - changedAt.getTime()
      : Number.POSITIVE_INFINITY;

    if (
      remainingMs > 0 &&
      remainingMs <= thresholdMs &&
      (lastShowingChanged || previousRemainingMs > thresholdMs)
    ) {
      push(
        createEvent({
          kind: "final_showing_soon",
          eventKey: [
            "final_showing_soon",
            input.movieId,
            input.locationId,
            toIso(input.current.lastShowingAt),
          ].join(":"),
          movieId: input.movieId,
          locationId: input.locationId,
          previous,
          current: input.current,
          changedAt,
          sourceSyncRunId: input.sourceSyncRunId,
          metadata: {
            finalShowingSoonHours: input.finalShowingSoonHours,
            finalShowingAt: input.current.lastShowingAt.toISOString(),
          },
        }),
      );
    }
  }

  return [...events.values()];
}

export async function insertAvailabilityEvents(events: AvailabilityEventRecord[]) {
  if (!events.length) {
    return 0;
  }

  const db = getDb();

  for (const event of events) {
    await db
      .insert(availabilityChangeEvents)
      .values(event)
      .onConflictDoNothing({
        target: availabilityChangeEvents.eventKey,
      });
  }

  return events.length;
}
