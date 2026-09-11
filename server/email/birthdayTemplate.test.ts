import { describe, expect, it } from "vitest";
import { previewBirthdayTemplate } from "./birthdayTemplate";

describe("birthday email preview", () => {
  it("renders only supported birthday placeholders without creating a delivery", () => {
    const preview = previewBirthdayTemplate({ subjectTemplate: "Happy birthday, {{firstName}}", bodyTemplate: "Congratulations {{displayName}} — {{unknown}}", displayName: "Ada Lovelace" });
    expect(preview).toEqual({ displayName: "Ada Lovelace", firstName: "Ada", subject: "Happy birthday, Ada", bodyText: "Congratulations Ada Lovelace — {{unknown}}" });
  });
});
