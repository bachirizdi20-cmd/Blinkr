const RESEND_ENDPOINT = "https://api.resend.com/emails";

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}

export async function sendAuthEmail(input: { to: string; subject: string; title: string; body: string; actionUrl: string }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Email service is not configured");
  }

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0b0d0f;color:#f4f7f5;padding:32px"><div style="max-width:560px;margin:auto;background:#151a1d;border-radius:16px;padding:28px"><h1 style="color:#36d6a4">${input.title}</h1><p style="line-height:1.7">${input.body}</p><p><a href="${input.actionUrl}" style="display:inline-block;background:#36d6a4;color:#07120e;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">Continue</a></p><p style="color:#9aa6a1;font-size:12px">If you did not request this, you can safely ignore this email.</p></div></body></html>`;
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Reelog <${getFromEmail()}>`, to: [input.to], subject: input.subject, html, text: `${input.body}\n\n${input.actionUrl}` }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[Email] Resend request failed", response.status, details.slice(0, 300));
    throw new Error("Unable to send email");
  }
}

export function getPublicApiBaseUrl() {
  return process.env.PUBLIC_API_BASE_URL || "http://localhost:3000";
}
