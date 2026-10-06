// services/admin-dashboard/lib/registration-status.test.ts
/**
 * Vitest suite for the registration-status helper behind the Program
 * Specifics badge.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  buildAllowRegistrationPatch,
  getRegistrationStatus,
  getRegistrationStatusReason,
  isSwitchedOffDuringOpenWindow,
} from "./registration-status.ts";

const NOW = new Date("2026-10-06T02:00:00.000Z"); // 09:00 WIB

// The JYS 5th shape from the 2026-10-06 incident: window already open, switch off.
const OPEN_WINDOW = {
  registrationOpenDate: "2026-10-05T16:59:00.000Z", // 5 Oct 23:59 WIB
  registrationCloseDate: "2027-04-10T16:59:00.000Z",
};

describe("registration-status", () => {
  it("is Open when the switch is on and now falls inside the window", () => {
    assert.equal(getRegistrationStatus({ allowRegistration: true, ...OPEN_WINDOW }, NOW), "Open");
  });

  it("is Open when the switch is on and no window is configured", () => {
    assert.equal(getRegistrationStatus({ allowRegistration: true }, NOW), "Open");
  });

  it("is Scheduled before the open date and names that date in WIB", () => {
    const input = { allowRegistration: true, ...OPEN_WINDOW, registrationOpenDate: "2026-10-10T16:59:00.000Z" };
    assert.equal(getRegistrationStatus(input, NOW), "Scheduled");
    assert.match(getRegistrationStatusReason(input, NOW) ?? "", /^Opens 10 Oct 2026, 23:59 WIB$/);
  });

  it("is Closed after the close date and names that date in WIB", () => {
    const input = { allowRegistration: true, ...OPEN_WINDOW, registrationCloseDate: "2026-10-05T17:30:00.000Z" };
    assert.equal(getRegistrationStatus(input, NOW), "Closed");
    assert.match(getRegistrationStatusReason(input, NOW) ?? "", /^Closed since 6 Oct 2026, 00:30 WIB$/);
  });

  it("is Disabled whenever the switch is off, regardless of the window", () => {
    assert.equal(getRegistrationStatus({ allowRegistration: false, ...OPEN_WINDOW }, NOW), "Disabled");
    assert.equal(getRegistrationStatus({ allowRegistration: false }, NOW), "Disabled");
  });

  it("explains a Disabled status instead of leaving it bare", () => {
    const reason = getRegistrationStatusReason({ allowRegistration: false, ...OPEN_WINDOW }, NOW);
    assert.match(reason ?? "", /switched off/i);
  });

  it("gives no reason when registration is simply open", () => {
    assert.equal(getRegistrationStatusReason({ allowRegistration: true, ...OPEN_WINDOW }, NOW), null);
  });

  it("flags the switch being off while the window says registration should be open", () => {
    assert.equal(isSwitchedOffDuringOpenWindow({ allowRegistration: false, ...OPEN_WINDOW }, NOW), true);
  });

  it("does not flag a switched-off program whose window has not opened or has ended", () => {
    const upcoming = { allowRegistration: false, ...OPEN_WINDOW, registrationOpenDate: "2026-10-10T16:59:00.000Z" };
    const ended = { allowRegistration: false, ...OPEN_WINDOW, registrationCloseDate: "2026-10-05T17:30:00.000Z" };
    assert.equal(isSwitchedOffDuringOpenWindow(upcoming, NOW), false);
    assert.equal(isSwitchedOffDuringOpenWindow(ended, NOW), false);
  });

  it("does not flag a switched-off program with no window at all", () => {
    // Legacy/completed programs sit here permanently; nagging on them is noise.
    assert.equal(isSwitchedOffDuringOpenWindow({ allowRegistration: false }, NOW), false);
  });

  it("sends allowRegistration only when the admin flipped it", () => {
    assert.deepEqual(buildAllowRegistrationPatch(false, true), { allowRegistration: true });
    assert.deepEqual(buildAllowRegistrationPatch(true, false), { allowRegistration: false });
  });

  it("omits allowRegistration when untouched so a stale snapshot cannot overwrite it", () => {
    assert.deepEqual(buildAllowRegistrationPatch(true, true), {});
    assert.deepEqual(buildAllowRegistrationPatch(false, false), {});
  });

  it("does not flag when the switch is on", () => {
    assert.equal(isSwitchedOffDuringOpenWindow({ allowRegistration: true, ...OPEN_WINDOW }, NOW), false);
  });
});
