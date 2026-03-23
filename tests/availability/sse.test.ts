import { describe, expect, it } from "vitest";
import { formatSseComment, formatSseEvent } from "@/modules/availability/sse";

describe("availability event stream helpers", () => {
  it("formats event frames", () => {
    expect(formatSseEvent("dashboard-refresh", { ok: true })).toBe(
      'event: dashboard-refresh\ndata: {"ok":true}\n\n',
    );
  });

  it("formats comment frames", () => {
    expect(formatSseComment("heartbeat")).toBe(": heartbeat\n\n");
  });
});
