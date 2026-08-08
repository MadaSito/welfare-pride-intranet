import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { profilesRouter } from "./routers/profiles";
import { announcementsRouter, calendarsRouter, eventsRouter } from "./routers/companyContent";
import { documentsRouter, technologyRouter } from "./routers/resources";
import { companyPagesRouter, linksRouter } from "./routers/companyPages";
import { adminSettingsRouter, backupsRouter } from "./routers/admin";
import { localAuthRouter } from "./routers/localAuth";
import { searchRouter } from "./routers/search";
import { dashboardPinsRouter } from "./routers/dashboardPins";
import { assistantRouter } from "./routers/assistant";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: localAuthRouter,

  profiles: profilesRouter,
  announcements: announcementsRouter,
  events: eventsRouter,
  calendars: calendarsRouter,
  documents: documentsRouter,
  technology: technologyRouter,
  links: linksRouter,
  companyPages: companyPagesRouter,
  adminSettings: adminSettingsRouter,
  backups: backupsRouter,
  search: searchRouter,
  dashboardPins: dashboardPinsRouter,
  assistant: assistantRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
