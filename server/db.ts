import { randomUUID } from "node:crypto";
import { and, eq, desc, isNull, gt, or, not, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertMediaStatus, InsertReview, InsertUser, InsertUserData, MediaStatus, Review, authTokens, blocks, follows, notifications, reports, reviewComments, reviewLikes, mediaStatuses, reviews, UserData, userData, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { randomBytes, createHash } from "node:crypto";

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

export async function createAuthToken(input: { userId: number; kind: "verify_email" | "reset_password"; ttlMs: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  await db.update(authTokens).set({ consumedAt: new Date() }).where(and(eq(authTokens.userId, input.userId), eq(authTokens.kind, input.kind), isNull(authTokens.consumedAt)));
  await db.insert(authTokens).values({ userId: input.userId, tokenHash, kind: input.kind, expiresAt: new Date(Date.now() + input.ttlMs) });
  return raw;
}

export async function consumeAuthToken(raw: string, kind: "verify_email" | "reset_password") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const rows = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.kind, kind), isNull(authTokens.consumedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
  const token = rows[0];
  if (!token) return undefined;
  await db.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, token.id));
  return token;
}

export async function markEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
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

export async function searchUsers(viewerId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: users.id, name: users.name, username: userData.username, bio: userData.bio, avatarUrl: userData.avatarUrl, isPrivate: userData.isPrivate }).from(users).leftJoin(userData, eq(userData.userId, users.id)).where(not(eq(users.id, viewerId))).limit(50);
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => !needle || `${row.username ?? ""} ${row.name ?? ""}`.toLowerCase().includes(needle));
}

export async function toggleFollow(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (followerId === followingId) throw new Error("Cannot follow yourself");
  const existing = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).limit(1);
  if (existing[0]) {
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    return { following: false } as const;
  }
  await db.insert(follows).values({ followerId, followingId });
  await db.insert(notifications).values({ userId: followingId, actorId: followerId, kind: "follow" });
  return { following: true } as const;
}

export async function listFollowingIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ followingId: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
  return rows.map((row) => row.followingId);
}

export async function listSocialFeed(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const followingIds = await listFollowingIds(userId);
  if (!followingIds.length) return [];
  const blocked = await db.select({ blockedUserId: blocks.blockedUserId }).from(blocks).where(eq(blocks.userId, userId));
  const blockedIds = blocked.map((row) => row.blockedUserId);
  const allowedIds = followingIds.filter((id) => !blockedIds.includes(id));
  if (!allowedIds.length) return [];
  return db.select({ review: reviews, username: userData.username, displayName: users.name, avatarUrl: userData.avatarUrl }).from(reviews).innerJoin(users, eq(users.id, reviews.userId)).leftJoin(userData, eq(userData.userId, reviews.userId)).where(and(inArray(reviews.userId, allowedIds), or(isNull(userData.isPrivate), eq(userData.isPrivate, false)))).orderBy(desc(reviews.updatedAt)).limit(50);
}

export async function toggleReviewLike(userId: number, reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const review = (await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1))[0];
  if (!review) throw new Error("Review not found");
  const existing = await db.select().from(reviewLikes).where(and(eq(reviewLikes.reviewId, reviewId), eq(reviewLikes.userId, userId))).limit(1);
  if (existing[0]) {
    await db.delete(reviewLikes).where(eq(reviewLikes.id, existing[0].id));
    return { liked: false } as const;
  }
  await db.insert(reviewLikes).values({ reviewId, userId });
  if (review.userId !== userId) await db.insert(notifications).values({ userId: review.userId, actorId: userId, kind: "like", reviewId });
  return { liked: true } as const;
}

export async function addReviewComment(userId: number, reviewId: number, text: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const review = (await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1))[0];
  if (!review) throw new Error("Review not found");
  await db.insert(reviewComments).values({ reviewId, userId, text });
  if (review.userId !== userId) await db.insert(notifications).values({ userId: review.userId, actorId: userId, kind: "comment", reviewId });
  return { success: true } as const;
}

export async function listReviewComments(reviewId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ comment: reviewComments, name: users.name, username: userData.username }).from(reviewComments).innerJoin(users, eq(users.id, reviewComments.userId)).leftJoin(userData, eq(userData.userId, reviewComments.userId)).where(eq(reviewComments.reviewId, reviewId)).orderBy(desc(reviewComments.createdAt)).limit(100);
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function markNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function addBlock(userId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(blocks).values({ userId, blockedUserId }).onDuplicateKeyUpdate({ set: { blockedUserId } });
  await db.delete(follows).where(or(and(eq(follows.followerId, userId), eq(follows.followingId, blockedUserId)), and(eq(follows.followerId, blockedUserId), eq(follows.followingId, userId))));
  return { success: true } as const;
}

export async function createReport(input: { reporterId: number; targetType: string; targetId: number; reason: string; details?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reports).values(input);
  return { success: true } as const;
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
