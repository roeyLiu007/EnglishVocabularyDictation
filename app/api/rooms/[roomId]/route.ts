import { NextResponse } from "next/server";
import { getRoom, listAnswers } from "@/lib/server/store";

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const room = await getRoom(params.roomId);
  if (!room) {
    return NextResponse.json({ error: "房间不存在" }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get("token");
  const role = token === room.parentToken ? "parent" : token === room.childToken ? "child" : null;
  if (!role) {
    return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
  }

  const answers = await listAnswers(room.id);
  return NextResponse.json({
    room: role === "child" ? { ...room, parentToken: "", childToken: "" } : room,
    answers,
    role
  });
}
