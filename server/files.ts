import type { Express } from "express";
import { authenticateRequest } from "./auth/session";
import { isLocalStorage, storageGetSignedUrl, storageReadLocal } from "./storage";

export function registerFileRoutes(app: Express) {
  app.get(/^\/api\/files\/(.+)$/, async (req, res) => {
    try {
      await authenticateRequest(req);
      const encodedPath = req.originalUrl.split("?", 1)[0]?.slice("/api/files/".length) || "";
      const key = decodeURIComponent(encodedPath);
      if (!key) return res.status(400).json({ error: "Missing file key" });
      if (isLocalStorage()) {
        const content = await storageReadLocal(key);
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.send(content);
      }
      return res.redirect(302, await storageGetSignedUrl(key));
    } catch (error) {
      const message = error instanceof Error ? error.message : "File unavailable";
      return res.status(message.includes("session") ? 401 : 404).json({ error: "File unavailable" });
    }
  });
}
