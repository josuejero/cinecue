import { describe, expect, it } from "vitest";
import { normalizeTheatreIdentityKey } from "@/modules/theatres/normalize";

describe("theatre normalization", () => {
  it("builds theatre identity keys", () => {
    expect(
      normalizeTheatreIdentityKey({
        name: "AMC Empire 25",
        address1: "234 W 42nd St",
        address2: null,
        city: "New York",
        state: "NY",
        postalCode: "10036",
        countryCode: "USA",
      }),
    ).toBe("amc empire 25|234 w 42nd st new york ny 10036|10036|USA");
  });
});
