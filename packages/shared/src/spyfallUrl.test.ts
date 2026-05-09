import { describe, expect, it } from "vitest";
import { getSpyfallEntryUrl } from "./spyfallUrl";

describe("getSpyfallEntryUrl", () => {
  it("builds lobby-only URL with encoded lobby", () => {
    expect(getSpyfallEntryUrl({ lobbyCode: "room#1" })).toBe(
      "/spyfall?lobby=room%231",
    );
  });

  it("includes encoded display name when present", () => {
    expect(
      getSpyfallEntryUrl({
        lobbyCode: "a",
        displayName: "A & B",
      }),
    ).toBe("/spyfall?lobby=a&name=A%20%26%20B");
  });
});
