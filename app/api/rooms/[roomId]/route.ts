import { NextResponse } from "next/server";
import { getRoom, listAnswers, startRoomTiming } from "@/lib/server/store";

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const room = await getRoom(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    }

    const token = new URL(request.url).searchParams.get("token");
    const role = token === room.parentToken ? "parent" : token === room.childToken ? "child" : null;
    if (!role) {
      return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
    }

    const activeRoom = role === "child" ? await startRoomTiming(room.id) : room;
    if (!activeRoom) {
      return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    }

    const answers = await listAnswers(activeRoom.id);
    return NextResponse.json({
      room: role === "child" ? { ...activeRoom, parentToken: "", childToken: "" } : activeRoom,
      answers,
      role
    });
  } catch (error) {
    console.error("[api/rooms/:roomId] failed to load room", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "加载房间失败，请稍后重试" }, { status: 500 });
  }
}
