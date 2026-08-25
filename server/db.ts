import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertUserData, UserData, userData, users } from "../drizzle/schema";
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

export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userData).where(eq(userData.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}
