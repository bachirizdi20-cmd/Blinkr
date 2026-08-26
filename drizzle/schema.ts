import { boolean, int, longtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userData = mysqlTable("user_data", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 64 }).notNull().default("cinephile"),
  bio: varchar("bio", { length: 160 }).notNull().default(""),
  avatarUrl: text("avatarUrl"),
  isPrivate: boolean("isPrivate").notNull().default(false),
  libraryJson: longtext("libraryJson").notNull(),
  socialJson: longtext("socialJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex("user_data_user_id_idx").on(table.userId),
}));

export type UserData = typeof userData.$inferSelect;
export type InsertUserData = typeof userData.$inferInsert;

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mediaType: varchar("mediaType", { length: 8 }).notNull(),
  mediaId: int("mediaId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  posterPath: varchar("posterPath", { length: 255 }),
  rating: int("rating").notNull(),
  review: longtext("review").notNull(),
  spoiler: boolean("spoiler").notNull().default(false),
  watchedDate: timestamp("watchedDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userMediaIdx: uniqueIndex("reviews_user_media_idx").on(table.userId, table.mediaType, table.mediaId),
}));

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const mediaStatuses = mysqlTable("media_statuses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mediaType: varchar("mediaType", { length: 8 }).notNull(),
  mediaId: int("mediaId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  posterPath: varchar("posterPath", { length: 255 }),
  status: varchar("status", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userMediaIdx: uniqueIndex("media_statuses_user_media_idx").on(table.userId, table.mediaType, table.mediaId),
}));

export type MediaStatus = typeof mediaStatuses.$inferSelect;
export type InsertMediaStatus = typeof mediaStatuses.$inferInsert;
