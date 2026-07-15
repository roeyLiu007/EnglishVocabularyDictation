import { NextResponse } from "next/server";
import { appBaseUrl, buildRoomLink } from "@/lib/room-links";
import { isAdminRequest } from "@/lib/server/admin-auth";
import { listAnswersForRooms, listRooms } from "@/lib/server/store";
import type { RoomTaskSummary, SubmittedAnswer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "请先输入教师管理密码" }, { status: 401 });
  }

  try {
    const rooms = await listRooms();
    const answers = await listAnswersForRooms(rooms.map((room) => room.id));
    const answersByRoom = new Map<string, SubmittedAnswer[]>();
    for (const answer of answers) {
      const current = answersByRoom.get(answer.roomId) ?? [];
      current.push(answer);
      answersByRoom.set(answer.roomId, current);
    }

    const baseUrl = appBaseUrl(request.url, process.env.NEXT_PUBLIC_APP_URL);
    const tasks: RoomTaskSummary[] = rooms.map((room) => {
      const roomAnswers = answersByRoom.get(room.id) ?? [];
      const submittedTimes = roomAnswers.map((answer) => answer.submittedAt).filter(Boolean).sort();
      return {
        id: room.id,
        status: room.status,
        totalCount: room.totalCount,
        answeredCount: roomAnswers.length,
        correctCount: roomAnswers.filter((answer) => answer.verdict.overall === "correct").length,
        wrongCount: roomAnswers.filter((answer) => answer.verdict.overall === "wrong").length,
        pendingCount: roomAnswers.filter((answer) => answer.verdict.overall === "pending").length,
        wordSource: room.wordSource,
        stage: room.stage,
        dictationPerson: room.dictationPerson,
        createdAt: room.createdAt,
        lastSubmittedAt: submittedTimes.at(-1),
        parentUrl: buildRoomLink(baseUrl, "parent", room.id, room.parentToken),
        childUrl: buildRoomLink(baseUrl, "child", room.id, room.childToken)
      };
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[api/admin/rooms] failed to load tasks", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "加载听写任务失败" }, { status: 500 });
  }
}
