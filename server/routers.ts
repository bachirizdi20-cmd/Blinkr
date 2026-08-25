import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
  tmdb: router({
    get: publicProcedure
      .input(z.object({ path: tmdbPathSchema, params: tmdbParamsSchema.default({}) }))
      .query(({ input }) => fetchTmdbResource(input.path, input.params)),
  }),
});

export type AppRouter = typeof appRouter;
