import { cookies } from "next/headers";
import { adminCookieName, isAdminSessionToken } from "@/lib/server/admin-auth";

export function hasTeacherPageSession() {
  return isAdminSessionToken(cookies().get(adminCookieName)?.value ?? "");
}
