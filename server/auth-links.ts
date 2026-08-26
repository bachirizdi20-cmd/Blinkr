import type { Express, Request, Response } from "express";
import { consumeAuthToken, markEmailVerified, updateUserPassword } from "./db";
import { hashPassword } from "./password";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function page(title: string, body: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;background:#0b0d0f;color:#f4f7f5;padding:32px"><main style="max-width:560px;margin:auto;background:#151a1d;border-radius:16px;padding:28px"><h1 style="color:#36d6a4">${escapeHtml(title)}</h1>${body}</main></body></html>`;
}

export function registerAuthLinkRoutes(app: Express) {
  app.get("/api/auth/verify", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).send(page("Invalid link", "<p>This verification link is missing its token.</p>"));
    const record = await consumeAuthToken(token, "verify_email");
    if (!record) return res.status(400).send(page("Link expired", "<p>This verification link is invalid or expired. Request a new one from your profile.</p>"));
    await markEmailVerified(record.userId);
    return res.send(page("Email verified", "<p>Your Reelog email is verified. You can return to the app.</p>"));
  });

  app.get("/reset-password", (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).send(page("Invalid link", "<p>This reset link is missing its token.</p>"));
    return res.send(page("Reset your password", `<form method="post" action="/api/auth/reset-password"><input type="hidden" name="token" value="${escapeHtml(token)}"><label style="display:block;margin:16px 0 8px">New password</label><input name="password" type="password" minlength="8" maxlength="128" required style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #43504a;background:#0b0d0f;color:#f4f7f5"><button type="submit" style="margin-top:18px;background:#36d6a4;border:0;border-radius:999px;padding:12px 18px;font-weight:700">Save password</button></form>`));
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || password.length < 8 || password.length > 128) return res.status(400).send(page("Invalid request", "<p>Use a password between 8 and 128 characters.</p>"));
    const record = await consumeAuthToken(token, "reset_password");
    if (!record) return res.status(400).send(page("Link expired", "<p>This reset link is invalid or expired. Request a new one.</p>"));
    await updateUserPassword(record.userId, await hashPassword(password));
    return res.send(page("Password updated", "<p>Your password has been changed. You can return to Reelog and sign in.</p>"));
  });
}
