import type { Express } from "express";
import { isDatabaseAvatarKey, readDatabaseAvatar, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = (req.params as Record<string, string>)[0];
    if (!rawKey) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      if (isDatabaseAvatarKey(rawKey)) {
        const avatar = await readDatabaseAvatar(rawKey);
        if (!avatar) {
          res.status(404).send("Avatar not found");
          return;
        }
        res
          .status(200)
          .set("Content-Type", avatar.contentType)
          .set("Content-Length", String(avatar.data.byteLength))
          .set("X-Content-Type-Options", "nosniff")
          .set("Cache-Control", "public, max-age=31536000, immutable")
          .send(avatar.data);
        return;
      }

      const signedUrl = await storageGetSignedUrl(rawKey);
      res.set("Cache-Control", "private, max-age=300");
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("[StorageProxy] failed:", error);
      res.status(502).send("Storage backend error");
    }
  });
}
