import { describe, expect, it } from "vitest";
import { projectBirthdayDisplays } from "./birthdays";

describe("birthday privacy projection", () => {
  it("returns month and day only even when an upstream object contains a year", () => {
    const result = projectBirthdayDisplays([{ id: 1, displayName: "Employee", photoUrl: null, birthdayMonth: 8, birthdayDay: 14, birthdayYear: 1987 }]);
    expect(result).toEqual([{ profileId: 1, displayName: "Employee", photoUrl: null, month: 8, day: 14 }]);
    expect(JSON.stringify(result)).not.toContain("1987");
    expect(result[0]).not.toHaveProperty("year");
    expect(result[0]).not.toHaveProperty("birthdayYear");
  });

  it("omits incomplete birthdays and sorts by month and day", () => {
    const result = projectBirthdayDisplays([
      { id: 2, displayName: "Later", photoUrl: null, birthdayMonth: 12, birthdayDay: 3 },
      { id: 3, displayName: "Incomplete", photoUrl: null, birthdayMonth: 4, birthdayDay: null },
      { id: 1, displayName: "Earlier", photoUrl: null, birthdayMonth: 1, birthdayDay: 7 },
    ]);
    expect(result.map(item => item.displayName)).toEqual(["Earlier", "Later"]);
  });
});
