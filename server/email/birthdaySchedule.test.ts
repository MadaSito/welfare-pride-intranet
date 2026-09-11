import { describe, expect, it } from "vitest";
import { getBirthdayDispatchDate, isBirthdayDispatchDue, parseBirthdayDispatchSettings } from "./birthdaySchedule";

describe("birthday dispatch schedule", () => {
  it("evaluates the saved local dispatch time in the selected IANA timezone", () => {
    const now = new Date("2026-06-12T13:05:00.000Z");
    const settings = parseBirthdayDispatchSettings({ enabled: true, hour: 9, minute: 5, timeZone: "America/New_York" });
    expect(getBirthdayDispatchDate(now, settings.timeZone)).toMatchObject({ year: 2026, month: 6, day: 12, hour: 9, minute: 5 });
    expect(isBirthdayDispatchDue(now, settings)).toBe(true);
    expect(isBirthdayDispatchDue(new Date("2026-06-12T13:06:00.000Z"), settings)).toBe(false);
  });

  it("fails safely to defaults when stored schedule values are invalid and respects disabled delivery", () => {
    const settings = parseBirthdayDispatchSettings({ enabled: false, hour: 99, minute: 99, timeZone: "not/a-timezone" });
    expect(settings.enabled).toBe(false);
    expect(settings.hour).toBe(9);
    expect(settings.minute).toBe(0);
    expect(settings.timeZone).toBe("UTC");
    expect(isBirthdayDispatchDue(new Date("2026-06-12T09:00:00.000Z"), settings)).toBe(false);
  });
});
