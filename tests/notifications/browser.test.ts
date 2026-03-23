import { describe, expect, it } from "vitest";
import {
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "@/modules/notifications/browser";

describe("notification browser helpers", () => {
  it("decodes url-safe base64 into a uint8 array", () => {
    const array = urlBase64ToUint8Array("AQIDBA");
    expect(Array.from(array)).toEqual([1, 2, 3, 4]);
  });

  it("serializes push subscriptions from their JSON form", () => {
    const subscription = {
      toJSON() {
        return {
          endpoint: "https://example.com/push/123",
          expirationTime: null,
          keys: {
            p256dh: "p256dh-value",
            auth: "auth-value",
          },
        };
      },
    } as unknown as PushSubscription;

    expect(serializePushSubscription(subscription)).toEqual({
      endpoint: "https://example.com/push/123",
      expirationTime: null,
      keys: {
        p256dh: "p256dh-value",
        auth: "auth-value",
      },
    });
  });
});
