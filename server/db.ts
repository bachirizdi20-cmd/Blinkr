import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertMediaStatus, InsertReview, InsertUser, InsertUserData, MediaStatus, Review, mediaStatuses, reviews, UserData, userData, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createEmailUser(input: {
  email: string;
  passwordHash: string;
  name: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const openId = `email_${randomUUID()}`;
  await db.insert(users).values({
    openId,
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return getUserByOpenId(openId);
}

export async function getUserData(userId: number): Promise<UserData | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userData).where(eq(userData.userId, userId)).limit(1);
  return result[0];
}

export async function upsertUserData(userId: number, patch: Partial<Omit<InsertUserData, 'userId' | 'id'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserData(userId);
  if (existing) {
    await db.update(userData).set(patch).where(eq(userData.userId, userId));
    return { ...existing, ...patch };
  }
  const values: InsertUserData = {
    userId,
    username: patch.username ?? 'cinephile',
    bio: patch.bio ?? '',
    avatarUrl: patch.avatarUrl ?? null,
    isPrivate: patch.isPrivate ?? false,
    libraryJson: patch.libraryJson ?? '{}',
    socialJson: patch.socialJson ?? '{}',
  };
  await db.insert(userData).values(values);
  return await getUserData(userId);
}

export async function getUserReview(userId: number, mediaType: string, mediaId: number): Promise<Review | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.mediaType, mediaType), eq(reviews.mediaId, mediaId))).limit(1);
  return result[0];
}

export async function listUserReviews(userId: number): Promise<Review[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.updatedAt));
}

export async function upsertReview(input: Omit<InsertReview, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserReview(input.userId, input.mediaType, input.mediaId);
  if (existing) {
    await db.update(reviews).set({ title: input.title, posterPath: input.posterPath, rating: input.rating, review: input.review, spoiler: input.spoiler, watchedDate: input.watchedDate }).where(eq(reviews.id, existing.id));
    return getUserReview(input.userId, input.mediaType, input.mediaId);
  }
  await db.insert(reviews).values(input);
  return getUserReview(input.userId, input.mediaType, input.mediaId);
}

export async function deleteUserReview(userId: number, mediaType: string, mediaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reviews).where(and(eq(reviews.mediaType, mediaType), eq(reviews.mediaId, mediaId), eq(reviews.userId, userId)));
}

export async function listUserMediaStatuses(userId: number): Promise<MediaStatus[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaStatuses).where(eq(mediaStatuses.userId, userId)).orderBy(desc(mediaStatuses.updatedAt));
}

export async function getUserMediaStatus(userId: number, mediaType: string, mediaId: number): Promise<MediaStatus | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mediaStatuses).where(and(eq(mediaStatuses.userId, userId), eq(mediaStatuses.mediaType, mediaType), eq(mediaStatuses.mediaId, mediaId))).limit(1);
  return result[0];
}

export async function upsertMediaStatus(input: Omit<InsertMediaStatus, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserMediaStatus(input.userId, input.mediaType, input.mediaId);
  if (existing) {
    await db.update(mediaStatuses).set({ title: input.title, posterPath: input.posterPath, status: input.status }).where(eq(mediaStatuses.id, existing.id));
    return getUserMediaStatus(input.userId, input.mediaType, input.mediaId);
  }
  await db.insert(mediaStatuses).values(input);
  return getUserMediaStatus(input.userId, input.mediaType, input.mediaId);
}

export async function deleteMediaStatus(userId: number, mediaType: string, mediaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mediaStatuses).where(and(eq(mediaStatuses.userId, userId), eq(mediaStatuses.mediaType, mediaType), eq(mediaStatuses.mediaId, mediaId)));
}

export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reviews).where(eq(reviews.userId, userId));
  await db.delete(mediaStatuses).where(eq(mediaStatuses.userId, userId));
  await db.delete(userData).where(eq(userData.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}
