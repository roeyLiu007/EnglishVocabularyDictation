import type { DictationRoom } from "@/lib/types";

export type RoomLinkKind = "child" | "parent";

export function appBaseUrl(requestUrl: string, configuredUrl?: string) {
  const fallback = new URL(requestUrl).origin;
  const configured = configuredUrl?.trim();
  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return fallback;
    if (host === "localhost" || host === "127.0.0.1" || host.includes("你的域名")) return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export function buildRoomLink(baseUrl: string, kind: RoomLinkKind, roomId: string, token: string) {
  const url = new URL(baseUrl);
  url.pathname = `/${kind}/${encodeURIComponent(roomId)}`;
  url.search = new URLSearchParams({ token }).toString();
  url.hash = "";
  return url.toString();
}

export function completeRoomLinks(room: DictationRoom, parentUrl: string, childUrl: string, fallbackBaseUrl: string) {
  const parentBaseUrl = new URL(parentUrl || fallbackBaseUrl, fallbackBaseUrl).toString();
  const childBaseUrl = new URL(childUrl || fallbackBaseUrl, fallbackBaseUrl).toString();

  return {
    parentUrl: buildRoomLink(parentBaseUrl, "parent", room.id, room.parentToken),
    childUrl: buildRoomLink(childBaseUrl, "child", room.id, room.childToken)
  };
}
