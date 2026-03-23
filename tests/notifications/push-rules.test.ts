import { describe, expect, it } from "vitest";
import {
  getPushSkipReason,
  shouldDeactivatePushSubscription,
} from "@/modules/notifications/push-payload";

describe("push delivery rules", () => {
  const preferences = {
    pushEnabled: true,
    newlyScheduledEnabled: true,
    nowPlayingEnabled: true,
    advanceTicketsEnabled: true,
    theatreCountIncreasedEnabled: true,
    finalShowingSoonEnabled: true,
  };

  it("skips events that happened before the follow existed", () => {
    const changedAt = new Date("2026-03-22T10:00:00.000Z");
    const followCreatedAt = new Date("2026-03-22T11:00:00.000Z");
    const subscriptionCreatedAt = new Date("2026-03-22T09:00:00.000Z");

    expect(
      getPushSkipReason({
        preferences,
        eventKind: "now_playing",
        changedAt,
        followCreatedAt,
        subscriptionCreatedAt,
      }),
    ).toBe("follow_created_after_event");
  });

  it("skips events that predate the active subscription", () => {
    const changedAt = new Date("2026-03-22T10:00:00.000Z");
    const followCreatedAt = new Date("2026-03-22T09:00:00.000Z");
    const subscriptionCreatedAt = new Date("2026-03-22T11:00:00.000Z");

    expect(
      getPushSkipReason({
        preferences,
        eventKind: "now_playing",
        changedAt,
        followCreatedAt,
        subscriptionCreatedAt,
      }),
    ).toBe("subscription_created_after_event");
  });

  it("deactivates subscriptions for gone push endpoints", () => {
    expect(shouldDeactivatePushSubscription({ statusCode: 404 })).toBe(true);
    expect(shouldDeactivatePushSubscription({ statusCode: 410 })).toBe(true);
    expect(shouldDeactivatePushSubscription({ statusCode: 500 })).toBe(false);
  });
});
