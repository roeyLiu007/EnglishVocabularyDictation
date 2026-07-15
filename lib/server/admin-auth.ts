import { createHmac, timingSafeEqual } from "crypto";

export const adminCookieName = "dictation_admin_session";
const sessionPayload = "english-dictation-admin:v1";

function configuredPassword() {
  return process.env.DICTATION_ADMIN_PASSWORD?.trim() || "";
}

function sessionToken(password: string) {
  return createHmac("sha256", password).update(sessionPayload).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

export function isAdminConfigured() {
  return Boolean(configuredPassword());
}

export function verifyAdminPassword(value: string) {
  const password = configuredPassword();
  return Boolean(password) && safeEqual(value, password);
}

export function createAdminSessionToken() {
  const password = configuredPassword();
  if (!password) throw new Error("缺少 DICTATION_ADMIN_PASSWORD 环境变量");
  return sessionToken(password);
}

export function isAdminRequest(request: Request) {
  const password = configuredPassword();
  if (!password) return false;
  return safeEqual(cookieValue(request, adminCookieName), sessionToken(password));
}

export function isAdminSessionToken(value = "") {
  const password = configuredPassword();
  return Boolean(password) && safeEqual(value, sessionToken(password));
}
