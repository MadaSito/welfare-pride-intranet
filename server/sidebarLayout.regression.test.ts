import { describe, expect, it } from "vitest";
import { sidebarLayout } from "../client/src/lib/sidebarLayout";

describe("sidebar category layout contract", () => {
  it("reserves normal-flow height for every category and its menu content", () => {
    expect(sidebarLayout.group).toContain("shrink-0");
    expect(sidebarLayout.adminGroup).toContain("shrink-0");
    expect(sidebarLayout.groupContent).toContain("shrink-0");
    expect(sidebarLayout.blueHeading).toContain("h-8");
    expect(sidebarLayout.orangeHeading).toContain("h-8");
    expect(sidebarLayout.blueHeading).toContain("shrink-0");
    expect(sidebarLayout.orangeHeading).toContain("shrink-0");
  });

  it("keeps highlighted category headings in normal flow rather than overlaying rows", () => {
    for (const heading of [sidebarLayout.blueHeading, sidebarLayout.orangeHeading]) {
      expect(heading).not.toContain("absolute");
      expect(heading).not.toContain("-mt-");
      expect(heading).not.toContain("-mb-");
    }
  });
});
