import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

// Only share cookies across the known preview subdomains. Never derive a
// registrable parent domain from arbitrary production hosts such as *.onrender.com.
const SHARED_COOKIE_PARENT_DOMAINS = ["manuspre.computer", "manus.computer"];

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.secure || req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

function getParentDomain(hostname: string): string | undefined {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalizedHost || LOCAL_HOSTS.has(normalizedHost) || isIpAddress(normalizedHost)) {
    return undefined;
  }

  const matchedDomain = SHARED_COOKIE_PARENT_DOMAINS.find(
    (domain) => normalizedHost.endsWith("." + domain),
  );

  return matchedDomain ? "." + matchedDomain : undefined;
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname || req.headers.host?.split(":")[0] || "localhost";
  const secure = isSecureRequest(req);

  return {
    domain: getParentDomain(hostname),
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}

export function getCsrfCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    ...getSessionCookieOptions(req),
    httpOnly: false,
    sameSite: "lax",
  };
}
