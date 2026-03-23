import { describe, expect, it } from "vitest";
import {
  buildPushCopy,
  shouldSendPushForEventKind,
} from "@/modules/notifications/push-payload";

describe("push payload rules", () => {
  const enabledPreferences = {
    pushEnabled: true,
    newlyScheduledEnabled: true,
    nowPlayingEnabled: true,
    advanceTicketsEnabled: true,
    theatreCountIncreasedEnabled: true,
    finalShowingSoonEnabled: true,
  };

  it("respects the master push toggle", () => {
    expect(
      shouldSendPushForEventKind(
        {
          ...enabledPreferences,
          pushEnabled: false,
        },
        "now_playing",
      ),
    ).toBe(false);
  });

  it("respects per-event preferences", () => {
    expect(
      shouldSendPushForEventKind(
        {
          ...enabledPreferences,
          finalShowingSoonEnabled: false,
        },
        "final_showing_soon",
      ),
    ).toBe(false);
  });

  it("builds readable copy for theatre expansion", () => {
    const copy = buildPushCopy({
      eventKind: "theatre_count_increased",
      title: "Dune: Part Three",
      theatreCount: 4,
    });

    expect(copy.title).toBe("More nearby theatres");
    expect(copy.body).toContain("4 nearby theatres");
  });
});
