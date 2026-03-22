import { describe, expect, it } from "vitest";
import { formatSseComment, formatSseEvent } from "@/lib/phase5/sse";

describe("phase 5 sse helpers", () => {
  it("formats event frames", () => {
    expect(formatSseEvent("dashboard-refresh", { ok: true })).toBe(
      'event: dashboard-refresh\ndata: {"ok":true}\n\n',
    );
  });

  it("formats comment frames", () => {
    expect(formatSseComment("heartbeat")).toBe(": heartbeat\n\n");
  });
});
