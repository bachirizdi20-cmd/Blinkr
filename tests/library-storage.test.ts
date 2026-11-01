import { describe, expect, it } from "vitest";
import {
  getAccountLibraryStorageKeys,
  loadAccountLibraryStorage,
  type LibraryKeyValueStorage,
} from "../lib/library-storage";

class MemoryStorage implements LibraryKeyValueStorage {
  private values: Map<string, string>;
  private failOnceAt: string | null;

  constructor(initial: Record<string, string> = {}, failOnceAt: string | null = null) {
    this.values = new Map(Object.entries(initial));
    this.failOnceAt = failOnceAt;
  }

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    if (this.failOnceAt === key) {
      this.failOnceAt = null;
      throw new Error("Simulated storage write failure");
    }
    this.values.set(key, value);
  }

  async multiRemove(keys: string[]) {
    keys.forEach((key) => this.values.delete(key));
  }
}

describe("account-scoped library storage", () => {
  it("imports the legacy library into only the first signed-in account", async () => {
    const oldDiary = JSON.stringify([{ id: "old-review", review: "Keep this review" }]);
    const oldWatchlist = JSON.stringify({ "movie-42": { title: "Keep this title" } });
    const storage = new MemoryStorage({
      "@reelog/diary": oldDiary,
      "@reelog/watchlist": oldWatchlist,
      "@reelog/likes": JSON.stringify({ "movie-7": { title: "Favorite" } }),
    });

    const firstAccount = await loadAccountLibraryStorage(storage, "firebase-user-primary");
    expect(firstAccount.values.diary).toBe(oldDiary);
    expect(firstAccount.values.watchlist).toBe(oldWatchlist);
    expect(await storage.getItem("@reelog/diary")).toBeNull();

    const secondAccount = await loadAccountLibraryStorage(storage, "firebase-user-secondary");
    expect(Object.values(secondAccount.values).every((value) => value === null)).toBe(true);
    expect(firstAccount.keys.diary).not.toBe(secondAccount.keys.diary);
  });

  it("does not import the old library into two accounts when they load concurrently", async () => {
    const oldDiary = JSON.stringify([{ id: "one-owner-only", review: "Private legacy entry" }]);
    const storage = new MemoryStorage({ "@reelog/diary": oldDiary });

    const [primary, secondary] = await Promise.all([
      loadAccountLibraryStorage(storage, "firebase-user-primary"),
      loadAccountLibraryStorage(storage, "firebase-user-secondary"),
    ]);

    const imported = [primary, secondary].filter((result) => result.values.diary !== null);
    expect(imported).toHaveLength(1);
    expect(imported[0].values.diary).toBe(oldDiary);
  });

  it("keeps legacy values and reserves the same account if a copy fails", async () => {
    const accountKeys = getAccountLibraryStorageKeys("firebase-user-primary");
    const oldDiary = JSON.stringify([{ id: "retry-me", review: "Never delete before copy succeeds" }]);
    const storage = new MemoryStorage({ "@reelog/diary": oldDiary }, accountKeys.diary);

    await expect(loadAccountLibraryStorage(storage, "firebase-user-primary")).rejects.toThrow(
      "Simulated storage write failure",
    );
    expect(await storage.getItem("@reelog/diary")).toBe(oldDiary);

    const otherAccount = await loadAccountLibraryStorage(storage, "firebase-user-secondary");
    expect(otherAccount.values.diary).toBeNull();
    expect(await storage.getItem("@reelog/diary")).toBe(oldDiary);

    const retry = await loadAccountLibraryStorage(storage, "firebase-user-primary");
    expect(retry.values.diary).toBe(oldDiary);
    expect(await storage.getItem("@reelog/diary")).toBeNull();
  });

  it("does not overwrite existing account data while importing other legacy fields", async () => {
    const accountKeys = getAccountLibraryStorageKeys("firebase-user-primary");
    const savedDiary = JSON.stringify([{ id: "newer-review", review: "Already in this account" }]);
    const legacyDiary = JSON.stringify([{ id: "old-review", review: "Legacy review" }]);
    const legacyLikes = JSON.stringify({ "movie-7": { title: "Legacy favorite" } });
    const storage = new MemoryStorage({
      [accountKeys.diary]: savedDiary,
      "@reelog/diary": legacyDiary,
      "@reelog/likes": legacyLikes,
    });

    const result = await loadAccountLibraryStorage(storage, "firebase-user-primary");
    expect(result.values.diary).toBe(savedDiary);
    expect(result.values.likes).toBe(legacyLikes);
  });
});
