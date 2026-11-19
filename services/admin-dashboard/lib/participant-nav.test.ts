// services/admin-dashboard/lib/participant-nav.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNeighbours,
  parseParticipantNav,
  participantNavKey,
  readParticipantNav,
  saveParticipantNav,
} from "./participant-nav";

const nav = { ids: ["a", "b", "c"], listHref: "/programs/p1/participants?status=submitted&page=2" };

describe("parseParticipantNav", () => {
  it("accepts a valid payload", () => {
    expect(parseParticipantNav(JSON.stringify(nav))).toEqual(nav);
  });

  it.each([
    ["null", null],
    ["not json", "{oops"],
    ["array", "[]"],
    ["ids not strings", JSON.stringify({ ids: [1], listHref: "/x" })],
    ["ids missing", JSON.stringify({ listHref: "/x" })],
    ["absolute listHref", JSON.stringify({ ids: [], listHref: "https://evil.test" })],
    ["protocol-relative listHref", JSON.stringify({ ids: [], listHref: "//evil.test" })],
  ])("rejects %s", (_name, raw) => {
    expect(parseParticipantNav(raw)).toBeNull();
  });
});

describe("getNeighbours", () => {
  it("returns both neighbours in the middle", () => {
    expect(getNeighbours(nav, "b")).toEqual({ index: 1, total: 3, prevId: "a", nextId: "c" });
  });

  it("has no prev at the start and no next at the end", () => {
    expect(getNeighbours(nav, "a")?.prevId).toBeNull();
    expect(getNeighbours(nav, "c")?.nextId).toBeNull();
  });

  it("is null when the participant is not in the list or there is no nav", () => {
    expect(getNeighbours(nav, "zzz")).toBeNull();
    expect(getNeighbours(null, "a")).toBeNull();
  });
});

describe("sessionStorage round trip", () => {
  beforeEach(() => sessionStorage.clear());

  it("saves under the per-program key and reads it back", () => {
    saveParticipantNav("p1", nav);
    expect(sessionStorage.getItem(participantNavKey("p1"))).toBe(JSON.stringify(nav));
    expect(readParticipantNav("p1")).toEqual(nav);
    expect(readParticipantNav("other")).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveParticipantNav("p1", nav)).not.toThrow();
    spy.mockRestore();
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readParticipantNav("p1")).toBeNull();
    get.mockRestore();
  });
});
