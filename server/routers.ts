import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { hashPassword, normalizeEmail, verifyPassword } from "./password";
import { storagePut } from "./storage";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "./rate-limit";
import { createAuthToken, consumeAuthToken, markEmailVerified, updateUserPassword } from "./db";
import { sendAuthEmail } from "./email";

const tmdbPathSchema = z.string().regex(
  /^\/(?:trending|movie|tv|discover|genre|search|person|authentication)(?:\/[A-Za-z0-9_,-]+)*$/,
  "Unsupported TMDB resource",
);

const tmdbParamsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

function requestBaseUrl(req: { protocol?: string; headers: Record<string, unknown>; get?: (name: string) => string | undefined }) {
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol ?? "http";
  const host = req.get?.("host") ?? "localhost:3000";
  return `${protocol}://${host}`;
}

function toPublicUser(user: { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: Date; emailVerifiedAt?: Date | null }) {
  return { id: user.id, openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn, emailVerifiedAt: user.emailVerifiedAt ?? null };
}

async function fetchTmdbResource(path: string, params: Record<string, string | number | boolean>) {
  if (!ENV.tmdbApiReadToken) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TMDB is not configured" });
  }

  const query = new URLSearchParams({
    language: "en-US",
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.themoviedb.org/3${path}?${query}`, {
      headers: {
        Authorization: `Bearer ${ENV.tmdbApiReadToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as { status_message?: string } | null;
    if (!response.ok) {
      const message = body?.status_message ?? `TMDB request failed (${response.status})`;
      throw new TRPCError({
        code: response.status === 404 ? "NOT_FOUND" : response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY",
        message,
      });
    }
    return body;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TRPCError({ code: "TIMEOUT", message: "TMDB request timed out" });
    }
    throw new TRPCError({ code: "BAD_GATEWAY", message: "TMDB is temporarily unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    register: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(8).max(128),
        name: z.string().trim().min(2).max(80),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        const existing = await db.getUserByEmail(email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
        }

        const user = await db.createEmailUser({
          email,
          name: input.name.trim(),
          passwordHash: await hashPassword(input.password),
        });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create account" });

        const verificationToken = await createAuthToken({ userId: user.id, kind: "verify_email", ttlMs: 24 * 60 * 60 * 1000 });
        try {
          await sendAuthEmail({
            to: email,
            subject: "Verify your Reelog email",
            title: "Verify your email",
            body: "Confirm your email address to secure your Reelog account.",
            actionUrl: `${requestBaseUrl(ctx.req)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`,
          });
        } catch (error) {
          console.error("[Auth] Verification email failed", error);
        }

        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? email });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { sessionToken, user: toPublicUser(user) };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        try {
          assertLoginAllowed(email);
        } catch {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Please wait and try again." });
        }
        const user = await db.getUserByEmail(email);
        const valid = Boolean(user?.passwordHash && await verifyPassword(input.password, user.passwordHash));
        if (!user || !valid) {
          recordLoginFailure(email);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect" });
        }
        clearLoginFailures(email);

        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? email });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { sessionToken, user: toPublicUser({ ...user, lastSignedIn: new Date() }) };
      }),
    me: publicProcedure.query((opts) => opts.ctx.user),
    requestVerification: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "An email address is required" });
      const token = await createAuthToken({ userId: ctx.user.id, kind: "verify_email", ttlMs: 24 * 60 * 60 * 1000 });
      await sendAuthEmail({ to: ctx.user.email, subject: "Verify your Reelog email", title: "Verify your email", body: "Confirm your email address to secure your Reelog account.", actionUrl: `${requestBaseUrl(ctx.req)}/api/auth/verify?token=${encodeURIComponent(token)}` });
      return { success: true } as const;
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(32).max(128) })).mutation(async ({ input }) => {
      const token = await consumeAuthToken(input.token, "verify_email");
      if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid or expired" });
      await markEmailVerified(token.userId);
      return { success: true } as const;
    }),
    forgotPassword: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(normalizeEmail(input.email));
      if (user?.email && user.passwordHash) {
        const token = await createAuthToken({ userId: user.id, kind: "reset_password", ttlMs: 30 * 60 * 1000 });
        try {
          await sendAuthEmail({ to: user.email, subject: "Reset your Reelog password", title: "Reset your password", body: "Use the secure link below to choose a new password. This link expires in 30 minutes.", actionUrl: `${requestBaseUrl(ctx.req)}/reset-password?token=${encodeURIComponent(token)}` });
        } catch (error) {
          console.error("[Auth] Reset email failed", error);
        }
      }
      return { success: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(128), password: z.string().min(8).max(128) })).mutation(async ({ input }) => {
      const token = await consumeAuthToken(input.token, "reset_password");
      if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link is invalid or expired" });
      await updateUserPassword(token.userId, await hashPassword(input.password));
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  account: router({
    me: protectedProcedure.query(async ({ ctx }) => ({ user: ctx.user, data: await db.getUserData(ctx.user.id) })),
    uploadAvatar: protectedProcedure
      .input(z.object({ dataUri: z.string().max(7_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const match = input.dataUri.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=_-]+)$/);
        if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPEG, PNG, and WebP images are supported" });
        const [, contentType, encoded] = match;
        const data = Buffer.from(encoded, "base64");
        if (data.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image must be smaller than 5 MB" });
        const stored = await storagePut(`avatars/user-${ctx.user.id}`, data, contentType);
        return stored;
      }),
    updateProfile: protectedProcedure
      .input(z.object({ username: z.string().trim().min(2).max(64).optional(), bio: z.string().trim().max(160).optional(), avatarUrl: z.string().max(2_000_000).nullable().optional() }))
      .mutation(async ({ ctx, input }) => db.upsertUserData(ctx.user.id, input)),
    updatePrivacy: protectedProcedure
      .input(z.object({ isPrivate: z.boolean() }))
      .mutation(async ({ ctx, input }) => db.upsertUserData(ctx.user.id, input)),
    sync: protectedProcedure
      .input(z.object({ libraryJson: z.string().max(2_000_000), socialJson: z.string().max(2_000_000) }))
      .mutation(async ({ ctx, input }) => db.upsertUserData(ctx.user.id, input)),
    delete: protectedProcedure
      .input(z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }))
      .mutation(async ({ ctx }) => {
        await db.deleteUserAccount(ctx.user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
      }),
  }),
  reviews: router({
    mine: protectedProcedure.query(({ ctx }) => db.listUserReviews(ctx.user.id)),
    getMine: protectedProcedure.input(z.object({ mediaType: z.enum(["movie", "tv"]), mediaId: z.number().int().positive() })).query(({ ctx, input }) => db.getUserReview(ctx.user.id, input.mediaType, input.mediaId)),
    save: protectedProcedure.input(z.object({
      mediaType: z.enum(["movie", "tv"]),
      mediaId: z.number().int().positive(),
      title: z.string().trim().min(1).max(255),
      posterPath: z.string().max(255).nullable().optional(),
      rating: z.number().int().min(0).max(10),
      review: z.string().trim().max(5000),
      spoiler: z.boolean().default(false),
      watchedDate: z.string().datetime().nullable().optional(),
    })).mutation(({ ctx, input }) => db.upsertReview({
      userId: ctx.user.id,
      mediaType: input.mediaType,
      mediaId: input.mediaId,
      title: input.title,
      posterPath: input.posterPath ?? null,
      rating: input.rating,
      review: input.review,
      spoiler: input.spoiler,
      watchedDate: input.watchedDate ? new Date(input.watchedDate) : null,
    })),
    delete: protectedProcedure.input(z.object({ mediaType: z.enum(["movie", "tv"]), mediaId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.deleteUserReview(ctx.user.id, input.mediaType, input.mediaId);
      return { success: true } as const;
    }),
  }),
  social: router({
    users: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default("") })).query(({ ctx, input }) => db.searchUsers(ctx.user.id, input.query)),
    following: protectedProcedure.query(({ ctx }) => db.listFollowingIds(ctx.user.id)),
    feed: protectedProcedure.query(({ ctx }) => db.listSocialFeed(ctx.user.id)),
    toggleFollow: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => db.toggleFollow(ctx.user.id, input.userId)),
    notifications: protectedProcedure.query(({ ctx }) => db.listNotifications(ctx.user.id)),
    markNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => { await db.markNotificationsRead(ctx.user.id); return { success: true } as const; }),
    block: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => db.addBlock(ctx.user.id, input.userId)),
    report: protectedProcedure.input(z.object({ targetType: z.enum(["review", "comment", "user"]), targetId: z.number().int().positive(), reason: z.enum(["spam", "harassment", "spoiler", "other"]), details: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => db.createReport({ reporterId: ctx.user.id, ...input })),
    toggleLike: protectedProcedure.input(z.object({ reviewId: z.number().int().positive() })).mutation(({ ctx, input }) => db.toggleReviewLike(ctx.user.id, input.reviewId)),
    comments: protectedProcedure.input(z.object({ reviewId: z.number().int().positive() })).query(({ input }) => db.listReviewComments(input.reviewId)),
    addComment: protectedProcedure.input(z.object({ reviewId: z.number().int().positive(), text: z.string().trim().min(1).max(1000) })).mutation(({ ctx, input }) => db.addReviewComment(ctx.user.id, input.reviewId, input.text)),
  }),
  library: router({
    mine: protectedProcedure.query(({ ctx }) => db.listUserMediaStatuses(ctx.user.id)),
    getStatus: protectedProcedure.input(z.object({ mediaType: z.enum(["movie", "tv"]), mediaId: z.number().int().positive() })).query(({ ctx, input }) => db.getUserMediaStatus(ctx.user.id, input.mediaType, input.mediaId)),
    setStatus: protectedProcedure.input(z.object({
      mediaType: z.enum(["movie", "tv"]),
      mediaId: z.number().int().positive(),
      title: z.string().trim().min(1).max(255),
      posterPath: z.string().max(255).nullable().optional(),
      status: z.enum(["watched", "watching", "watchlist"]),
    })).mutation(({ ctx, input }) => db.upsertMediaStatus({
      userId: ctx.user.id,
      mediaType: input.mediaType,
      mediaId: input.mediaId,
      title: input.title,
      posterPath: input.posterPath ?? null,
      status: input.status,
    })),
    removeStatus: protectedProcedure.input(z.object({ mediaType: z.enum(["movie", "tv"]), mediaId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.deleteMediaStatus(ctx.user.id, input.mediaType, input.mediaId);
      return { success: true } as const;
    }),
  }),
  tmdb: router({
    get: publicProcedure
      .input(z.object({ path: tmdbPathSchema, params: tmdbParamsSchema.default({}) }))
      .query(({ input }) => fetchTmdbResource(input.path, input.params)),
  }),
});

export type AppRouter = typeof appRouter;
