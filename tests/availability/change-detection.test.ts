import { describe, expect, it } from "vitest";
import { buildAvailabilityEvents } from "@/modules/availability/change-detection";

describe("availability change detection", () => {
  it("emits newly scheduled and advance ticket events for first local scheduling", () => {
    const events = buildAvailabilityEvents({
      movieId: "movie_1",
      locationId: "location_1",
      currentBusinessDate: "2026-03-22",
      finalShowingSoonHours: 24,
      previous: {
        status: "no_local_schedule_yet",
        nextShowingAt: null,
        firstShowingAt: null,
        lastShowingAt: null,
        theatreCount: 0,
      },
      current: {
        status: "advance_tickets",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-03-29T19:30:00Z"),
        theatreCount: 1,
      },
      now: new Date("2026-03-22T12:00:00Z"),
    });

    expect(events.map((event) => event.eventKind)).toEqual(
      expect.arrayContaining(["status_changed", "newly_scheduled", "advance_tickets"]),
    );
  });

  it("emits now playing but not newly scheduled when moving from advance tickets", () => {
    const events = buildAvailabilityEvents({
      movieId: "movie_1",
      locationId: "location_1",
      currentBusinessDate: "2026-03-29",
      finalShowingSoonHours: 24,
      previous: {
        status: "advance_tickets",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 1,
      },
      current: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 1,
      },
      now: new Date("2026-03-29T16:00:00Z"),
    });

    expect(events.map((event) => event.eventKind)).toEqual(
      expect.arrayContaining(["status_changed", "now_playing"]),
    );
    expect(events.map((event) => event.eventKind)).not.toContain("newly_scheduled");
  });

  it("emits theatre_count_increased when coverage expands", () => {
    const events = buildAvailabilityEvents({
      movieId: "movie_1",
      locationId: "location_1",
      currentBusinessDate: "2026-03-29",
      finalShowingSoonHours: 24,
      previous: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 1,
      },
      current: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 3,
      },
      now: new Date("2026-03-29T16:00:00Z"),
    });

    expect(events.map((event) => event.eventKind)).toContain("theatre_count_increased");
  });

  it("emits final_showing_soon when last showing crosses the alert threshold", () => {
    const events = buildAvailabilityEvents({
      movieId: "movie_1",
      locationId: "location_1",
      currentBusinessDate: "2026-03-29",
      finalShowingSoonHours: 24,
      previous: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-03-31T12:00:00Z"),
        theatreCount: 2,
      },
      current: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-03-30T10:00:00Z"),
        theatreCount: 2,
      },
      now: new Date("2026-03-29T12:00:00Z"),
    });

    expect(events.map((event) => event.eventKind)).toContain("final_showing_soon");
  });

  it("emits nothing when the state is unchanged and no threshold is crossed", () => {
    const events = buildAvailabilityEvents({
      movieId: "movie_1",
      locationId: "location_1",
      currentBusinessDate: "2026-03-29",
      finalShowingSoonHours: 24,
      previous: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 2,
      },
      current: {
        status: "now_playing",
        nextShowingAt: new Date("2026-03-29T19:30:00Z"),
        firstShowingAt: new Date("2026-03-29T19:30:00Z"),
        lastShowingAt: new Date("2026-04-02T22:00:00Z"),
        theatreCount: 2,
      },
      now: new Date("2026-03-29T12:00:00Z"),
    });

    expect(events).toHaveLength(0);
  });
});
