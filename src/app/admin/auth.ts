import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "blackathon_admin";

function secret() {
  const s = process.env.SUBMISSION_EDIT_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD or SUBMISSION_EDIT_SECRET env var required");
  return s;
}

function signToken(payload: string) {
  const mac = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return payload;
}

export async function issueAdminCookie() {
  const token = signToken(`admin:${Date.now()}`);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAdminSignedIn(): Promise<boolean> {
  const store = await cookies();
  const tok = store.get(COOKIE)?.value;
  if (!tok) return false;
  const payload = verifyToken(tok);
  return payload?.startsWith("admin:") ?? false;
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
