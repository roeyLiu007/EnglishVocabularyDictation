import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/server/admin-auth";
import { closeRoom, getRoom } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "请先输入教师管理密码" }, { status: 401 });
  }

  try {
    const room = await getRoom(params.roomId);
    if (!room) return NextResponse.json({ error: "听写任务不存在" }, { status: 404 });
    if (room.status !== "active") {
      return NextResponse.json({ error: room.status === "closed" ? "听写任务已经关闭" : "已完成任务无需关闭" }, { status: 409 });
    }

    const closed = await closeRoom(room.id);
    return NextResponse.json({ room: closed });
  } catch (error) {
    console.error("[api/admin/rooms/:roomId/close] failed to close task", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "关闭听写任务失败" }, { status: 500 });
  }
}
