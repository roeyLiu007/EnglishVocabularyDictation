import { NextResponse } from "next/server";
import { completeRoom, getRoom } from "@/lib/server/store";

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const room = await getRoom(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    }

    const body = (await request.json()) as { token?: string };
    if (body.token !== room.parentToken && body.token !== room.childToken) {
      return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
    }
    if (room.status === "closed") {
      return NextResponse.json({ error: "本次听写已关闭，不能继续提交" }, { status: 409 });
    }

    const completed = await completeRoom(room.id);
    return NextResponse.json({ room: completed });
  } catch (error) {
    console.error("[api/rooms/:roomId/finish] failed to finish room", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "结束房间失败，请稍后重试" }, { status: 500 });
  }
}
