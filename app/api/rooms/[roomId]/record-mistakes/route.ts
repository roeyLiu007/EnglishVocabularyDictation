import { NextResponse } from "next/server";
import { getRoom, recordRoomMistakes } from "@/lib/server/store";

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const room = await getRoom(params.roomId);
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    const body = (await request.json()) as { token?: string };
    if (body.token !== room.parentToken) return NextResponse.json({ error: "只有教师可以记录错题" }, { status: 403 });
    const recorded = await recordRoomMistakes(room.id);
    return NextResponse.json({ room: recorded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "记录错题失败" }, { status: 400 });
  }
}
