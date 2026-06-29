import { NextResponse } from "next/server";
import { completeRoom, getRoom } from "@/lib/server/store";

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const room = await getRoom(params.roomId);
  if (!room) {
    return NextResponse.json({ error: "房间不存在" }, { status: 404 });
  }

  const body = (await request.json()) as { token?: string };
  if (body.token !== room.parentToken && body.token !== room.childToken) {
    return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
  }

  const completed = await completeRoom(room.id);
  return NextResponse.json({ room: completed });
}
