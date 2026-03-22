import { classifyAvailabilityChange } from "@/lib/phase3/notifications";
import { describe, expect, it } from "vitest";

describe("phase 3 notification classification", () => {
  it("classifies first now-playing appearance as newly scheduled", () => {
    expect(classifyAvailabilityChange(null, "now_playing")).toBe("newly_scheduled");
    expect(
      classifyAvailabilityChange("no_local_schedule_yet", "now_playing"),
    ).toBe("newly_scheduled");
  });

  it("classifies advance tickets distinctly", () => {
    expect(classifyAvailabilityChange("coming_soon", "advance_tickets")).toBe(
      "advance_tickets",
    );
  });

  it("classifies advance_tickets to now_playing as now playing", () => {
    expect(classifyAvailabilityChange("advance_tickets", "now_playing")).toBe(
      "now_playing",
    );
  });

  it("ignores unsupported transitions", () => {
    expect(classifyAvailabilityChange("now_playing", "stopped_playing")).toBeNull();
  });
});
