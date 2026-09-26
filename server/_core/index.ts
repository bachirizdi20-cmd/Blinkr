import "dotenv/config";
import "../../scripts/load-env.js";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomBytes } from "node:crypto";
import { parse as parseCookies } from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerAuthLinkRoutes } from "../auth-links";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { getCsrfCookieOptions } from "./cookies";

const CSRF_COOKIE_NAME = "blinkr_csrf";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (ENV.corsAllowedOrigins.includes(origin)) return true;
  if (!ENV.isProduction && /^https?:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  if (!ENV.isProduction && /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) return true;
  // Allow the temporary WebDev preview only during development; production uses the explicit list.
  return !ENV.isProduction && /^https:\/\/8081-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.manus\.computer$/.test(origin);
}

function hasBearerAuthorization(req: express.Request) {
  const authorization = req.headers.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS is allowlisted. Native clients use Bearer auth and normally do not send an Origin.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      if (req.method === "OPTIONS") {
        res.status(403).json({ error: "Origin is not allowed" });
        return;
      }
      next();
      return;
    }

    res.header("Vary", "Origin");
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token",
    );

    const cookies = parseCookies(req.headers.cookie ?? "");
    if (!cookies[CSRF_COOKIE_NAME]) {
      res.cookie(CSRF_COOKIE_NAME, randomBytes(32).toString("hex"), {
        ...getCsrfCookieOptions(req),
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    // Bearer-authenticated native requests are not exposed to browser CSRF.
    // Cookie-authenticated browser mutations must echo the readable CSRF cookie.
    const tokenProtectedReset = req.path === "/api/auth/reset-password";
    if (STATE_CHANGING_METHODS.has(req.method) && !hasBearerAuthorization(req) && !tokenProtectedReset) {
      const csrfCookie = cookies[CSRF_COOKIE_NAME];
      const csrfHeader = req.headers["x-csrf-token"];
      if (!csrfCookie || typeof csrfHeader !== "string" || csrfHeader !== csrfCookie) {
        res.status(403).json({ error: "CSRF validation failed" });
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthLinkRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
