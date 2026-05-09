import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAYER_PROFILE_STORAGE_KEY,
  defaultPlayerProfile,
  readPlayerProfile,
  writePlayerProfile,
} from "./playerProfile";

describe("playerProfile", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const ls = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("window", { localStorage: ls });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaultPlayerProfile returns empty strings", () => {
    expect(defaultPlayerProfile()).toEqual({
      displayName: "",
      playerNumber: "",
    });
  });

  it("round-trips profile via localStorage", () => {
    const profile = { displayName: "Sam", playerNumber: "3" };
    writePlayerProfile(profile);
    expect(readPlayerProfile()).toEqual(profile);
    expect(store.get(PLAYER_PROFILE_STORAGE_KEY)).toBe(JSON.stringify(profile));
  });

  it("readPlayerProfile returns null for missing key", () => {
    expect(readPlayerProfile()).toBeNull();
  });

  it("readPlayerProfile coerces invalid JSON to null", () => {
    store.set(PLAYER_PROFILE_STORAGE_KEY, "not-json");
    expect(readPlayerProfile()).toBeNull();
  });

  it("readPlayerProfile fills missing fields as empty strings", () => {
    store.set(PLAYER_PROFILE_STORAGE_KEY, "{}");
    expect(readPlayerProfile()).toEqual({
      displayName: "",
      playerNumber: "",
    });
  });
});
