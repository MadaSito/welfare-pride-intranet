import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerMicrosoftAuthRoutes } from "../auth/microsoft";
import { scheduledBackupHandler } from "../scheduled/backup";
import * as db from "../db";
import { registerFileRoutes } from "../files";

let frameOriginCache: { expiresAt: number; origins: string[] } = { expiresAt: 0, origins: [] };

async function getTechnologyFrameOrigins() {
  if (frameOriginCache.expiresAt > Date.now()) return frameOriginCache.origins;
  try {
    const embeds = await db.listActiveTechnologyEmbeds();
    const origins = Array.from(new Set(embeds.map(item => {
      try { return new URL(item.url).origin; } catch { return null; }
    }).filter((origin): origin is string => Boolean(origin))));
    frameOriginCache = { origins, expiresAt: Date.now() + 5 * 60_000 };
    return origins;
  } catch {
    return frameOriginCache.origins;
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(async (_req, res, next) => {
    const frameOrigins = await getTechnologyFrameOrigins();
    const developmentScripts = process.env.NODE_ENV === "development" ? " 'unsafe-inline' 'unsafe-eval'" : "";
    const upgradeInsecureRequests = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";
    res.setHeader("Content-Security-Policy", `default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'${developmentScripts}; connect-src 'self' https: wss:; frame-src 'self' ${frameOrigins.join(" ")}; form-action 'self'; frame-ancestors 'self'${upgradeInsecureRequests}`);
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/healthz", (_req, res) => res.status(200).json({ ok: true }));
  registerFileRoutes(app);
  registerMicrosoftAuthRoutes(app);
  app.post("/api/cron/dispatch", scheduledBackupHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
