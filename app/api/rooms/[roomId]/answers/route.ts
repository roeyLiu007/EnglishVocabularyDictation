import { NextResponse } from "next/server";
import { gradeAnswer } from "@/lib/dictation";
import { getRoom, saveAnswer } from "@/lib/server/store";
import type { AnswerInput, AnswerVerdict } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const room = await getRoom(params.roomId);
  if (!room) {
    return NextResponse.json({ error: "房间不存在" }, { status: 404 });
  }

  const body = (await request.json()) as {
    token?: string;
    questionId?: string;
    answer?: AnswerInput;
    verdictOverride?: AnswerVerdict;
  };

  const isParent = body.token === room.parentToken;
  const isChild = body.token === room.childToken;
  if (!isParent && !isChild) {
    return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
  }

  const question = room.questions.find((item) => item.id === body.questionId);
  if (!question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  const answer = body.answer ?? {};
  const verdict = isParent && body.verdictOverride ? body.verdictOverride : gradeAnswer(question, answer);
  const saved = await saveAnswer({
    roomId: room.id,
    questionId: question.id,
    answer,
    verdict,
    submittedAt: new Date().toISOString()
  });

  return NextResponse.json({ answer: saved });
}
