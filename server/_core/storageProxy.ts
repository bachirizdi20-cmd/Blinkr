import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0];
    if (!rawKey) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const signedUrl = await storageGetSignedUrl(rawKey);
      res.set("Cache-Control", "private, max-age=300");
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("[StorageProxy] failed:", error);
      res.status(502).send("Storage backend error");
    }
  });
}
