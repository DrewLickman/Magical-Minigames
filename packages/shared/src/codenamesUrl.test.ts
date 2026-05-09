import { describe, expect, it } from "vitest";
import { getCodenamesEntryUrl } from "./codenamesUrl";

describe("getCodenamesEntryUrl", () => {
  it("builds lobby-only URL with encoded lobby", () => {
    expect(getCodenamesEntryUrl({ lobbyCode: "ab 12" })).toBe(
      "/codenames?lobby=ab%2012",
    );
  });

  it("trims lobby and adds display name when provided", () => {
    expect(
      getCodenamesEntryUrl({
        lobbyCode: "  xyz  ",
        displayName: "  Pat  ",
      }),
    ).toBe("/codenames?lobby=xyz&name=Pat");
  });

  it("omits name param when display name is blank", () => {
    expect(
      getCodenamesEntryUrl({ lobbyCode: "1", displayName: "   " }),
    ).toBe("/codenames?lobby=1");
  });
});
