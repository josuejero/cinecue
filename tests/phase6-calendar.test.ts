import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ PHASE6_CALENDAR_DEFAULT_DURATION_MINUTES: 150 }),
}));

import { buildCalendarFile } from "@/lib/phase6/calendar";

describe("phase 6 calendar export", () => {
  it("builds a valid VCALENDAR payload and preserves local wall-clock time", () => {
    const ics = buildCalendarFile([
      {
        showtimeId: "show_1",
        movieId: "movie_1",
        title: "The Example Movie",
        runtimeMinutes: 120,
        theatreId: "theatre_1",
        theatreName: "AMC Example 9",
        theatreAddress1: "123 Main St",
        theatreCity: "New York",
        theatreState: "NY",
        theatreTimeZone: "America/New_York",
        startAtLocal: "2026-03-25T19:30:00",
      },
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:The Example Movie");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260325T193000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260325T213000");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("uses the default duration, escapes text, and folds long lines", () => {
    const ics = buildCalendarFile([
      {
        showtimeId: "show_2",
        movieId: "movie_2",
        title: "Movie, With; Punctuation",
        runtimeMinutes: null,
        theatreId: "theatre_2",
        theatreName:
          "A Very Long Theatre Name That Forces The Calendar Line To Fold Across Multiple Segments",
        theatreAddress1: "456 Broadway",
        theatreCity: "New York",
        theatreState: "NY",
        theatreTimeZone: null,
        startAtLocal: "2026-03-25T19:30:00",
      },
    ]);

    expect(ics).toContain("DTEND;TZID=America/New_York:20260325T220000");
    expect(ics).toContain("SUMMARY:Movie\\, With\\; Punctuation");
    expect(ics).toContain("\r\n ");
  });
});
