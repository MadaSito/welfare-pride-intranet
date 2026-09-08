export const BUILT_IN_PORTAL_RESOURCES = [
  { resourceKey: "module:dashboard", label: "Dashboard", path: "/", navigationGroup: "Workplace", iconKey: "home", sortOrder: 10 },
  { resourceKey: "module:announcements", label: "Announcements", path: "/announcements", navigationGroup: "Workplace", iconKey: "megaphone", sortOrder: 20 },
  { resourceKey: "module:events", label: "Events", path: "/events", navigationGroup: "Workplace", iconKey: "calendar", sortOrder: 30 },
  { resourceKey: "module:links", label: "Important Links", path: "/links", navigationGroup: "Workplace", iconKey: "link", sortOrder: 40 },
  { resourceKey: "module:people", label: "Employee Directory", path: "/people", navigationGroup: "People", iconKey: "users", sortOrder: 50 },
  { resourceKey: "module:organization", label: "Organization Chart", path: "/organization", navigationGroup: "People", iconKey: "network", sortOrder: 60 },
  { resourceKey: "module:calendars", label: "Calendars", path: "/calendars", navigationGroup: "People", iconKey: "calendar-heart", sortOrder: 70 },
  { resourceKey: "module:hr", label: "Human Resources", path: "/hr", navigationGroup: "Company", iconKey: "file-text", sortOrder: 80 },
  { resourceKey: "module:about", label: "About Welfare Pride", path: "/about", navigationGroup: "Company", iconKey: "info", sortOrder: 90 },
  { resourceKey: "module:founders", label: "Founders", path: "/founders", navigationGroup: "Company", iconKey: "users-round", sortOrder: 100 },
  { resourceKey: "module:technology", label: "Technology", path: "/technology", navigationGroup: "Company", iconKey: "laptop", sortOrder: 110 },
  { resourceKey: "module:business-management", label: "Business Management", path: "/business-management", navigationGroup: "Business Management", iconKey: "briefcase", sortOrder: 120 },
] as const;

export type BuiltInPortalResourceKey = (typeof BUILT_IN_PORTAL_RESOURCES)[number]["resourceKey"];
export type PortalResourceAccessMode = "all_authenticated" | "restricted";
export type PortalAssignmentSubjectType = "user" | "entra_group";
