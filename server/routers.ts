import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { profilesRouter } from "./routers/profiles";
import { announcementsRouter, calendarsRouter, eventsRouter } from "./routers/companyContent";
import { documentsRouter, technologyRouter } from "./routers/resources";
import { companyPagesRouter, linksRouter } from "./routers/companyPages";
import { adminSettingsRouter, backupsRouter } from "./routers/admin";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

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

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
