import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { ENV } from "./_core/env";

const tmdbPathSchema = z.string().regex(
  /^\/(?:trending|movie|tv|discover|genre|search|person|authentication)(?:\/[A-Za-z0-9_,-]+)*$/,
  "Unsupported TMDB resource",
);

const tmdbParamsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

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
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  account: router({
    me: protectedProcedure.query(async ({ ctx }) => ({ user: ctx.user, data: await db.getUserData(ctx.user.id) })),
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
  tmdb: router({
    get: publicProcedure
      .input(z.object({ path: tmdbPathSchema, params: tmdbParamsSchema.default({}) }))
      .query(({ input }) => fetchTmdbResource(input.path, input.params)),
  }),
});

export type AppRouter = typeof appRouter;
