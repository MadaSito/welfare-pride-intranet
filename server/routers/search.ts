import { z } from "zod";
import * as db from "../db";
import { listAuthorizedSharePointDocuments } from "../integrations/sharePoint";
import { protectedProcedure, router } from "../_core/trpc";

function snippet(value: string | null | undefined, limit = 150) {
  const normalized = (value || "").replace(/[#*_`>\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}…` : normalized;
}

export const searchRouter = router({
  unified: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120), limitPerSource: z.number().int().min(1).max(10).default(6) }))
    .query(async ({ ctx, input }) => {
      const [people, announcements, documents] = await Promise.all([
        db.searchEmployeeProfiles(input.query, input.limitPerSource),
        db.searchPublishedAnnouncements(input.query, input.limitPerSource),
        listAuthorizedSharePointDocuments({ userId: ctx.user.id, query: input.query })
          .then(items => ({ status: "connected" as const, items: items.filter(item => !item.isFolder).slice(0, input.limitPerSource) }))
          .catch(error => ({ status: "unavailable" as const, message: error instanceof Error ? error.message : "HR document search is unavailable.", items: [] })),
      ]);

      const peopleResults = people.map(item => ({
        id: `person:${item.id}`,
        source: "people" as const,
        title: item.displayName,
        subtitle: [item.jobTitle, item.department].filter(Boolean).join(" · ") || item.email || "Employee",
        href: `/people?employee=${item.id}`,
        imageUrl: item.photoUrl,
      }));
      const announcementResults = announcements.map(item => ({
        id: `announcement:${item.id}`,
        source: "announcements" as const,
        title: item.title,
        subtitle: snippet(item.summary || item.body),
        href: `/announcements?announcement=${item.id}`,
        imageUrl: null,
      }));
      const documentResults = documents.items.map(item => ({
        id: `document:${item.id}`,
        source: "hr_documents" as const,
        title: item.name,
        subtitle: `${item.category}${item.mimeType ? ` · ${item.mimeType}` : ""}`,
        href: item.webUrl,
        imageUrl: null,
      }));

      return {
        query: input.query,
        results: [...peopleResults, ...announcementResults, ...documentResults],
        groups: { people: peopleResults, announcements: announcementResults, documents: documentResults },
        sourceStatus: { people: "connected" as const, announcements: "connected" as const, documents: documents.status },
        documentMessage: "message" in documents ? documents.message : undefined,
      };
    }),
});
