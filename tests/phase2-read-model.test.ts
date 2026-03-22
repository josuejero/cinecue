import { deriveMovieLocalState } from "@/lib/phase2/read-model";
import { describe, expect, it } from "vitest";

describe("phase 2 read model derivation", () => {
  it("marks same-day upcoming showings as now_playing", () => {
    const result = deriveMovieLocalState({
      currentBusinessDate: "2026-03-21",
      releaseDate: "2026-03-21",
      showings: [
        {
          theatreId: "theatre_1",
          businessDate: "2026-03-21",
          startAtLocal: new Date("2026-03-21T19:30:00Z"),
          isAdvanceTicket: false,
        },
      ],
    });

    expect(result.status).toBe("now_playing");
    expect(result.theatreCount).toBe(1);
  });

  it("marks future scheduled showings as advance_tickets", () => {
    const result = deriveMovieLocalState({
      currentBusinessDate: "2026-03-21",
      releaseDate: "2026-03-28",
      showings: [
        {
          theatreId: "theatre_1",
          businessDate: "2026-03-28",
          startAtLocal: new Date("2026-03-28T19:30:00Z"),
          isAdvanceTicket: true,
        },
      ],
    });

    expect(result.status).toBe("advance_tickets");
    expect(result.theatreCount).toBe(1);
  });

  it("marks future unreleased movies without showings as coming_soon", () => {
    const result = deriveMovieLocalState({
      currentBusinessDate: "2026-03-21",
      releaseDate: "2026-04-11",
      showings: [],
    });

    expect(result.status).toBe("coming_soon");
  });

  it("marks movies with only past showings as stopped_playing", () => {
    const result = deriveMovieLocalState({
      currentBusinessDate: "2026-03-21",
      releaseDate: "2026-03-01",
      showings: [
        {
          theatreId: "theatre_1",
          businessDate: "2026-03-10",
          startAtLocal: new Date("2026-03-10T19:30:00Z"),
          isAdvanceTicket: false,
        },
      ],
    });

    expect(result.status).toBe("stopped_playing");
  });

  it("marks released movies with no local history as no_local_schedule_yet", () => {
    const result = deriveMovieLocalState({
      currentBusinessDate: "2026-03-21",
      releaseDate: "2026-03-01",
      showings: [],
    });

    expect(result.status).toBe("no_local_schedule_yet");
  });
});