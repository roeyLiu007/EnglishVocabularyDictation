import { NextResponse } from "next/server";
import { buildQuestions } from "@/lib/dictation";
import { createRoom, listWords } from "@/lib/server/store";
import type { CreateRoomInput, DictationRoom } from "@/lib/types";

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  const input = (await request.json()) as CreateRoomInput;
  const words = await listWords();

  if (!words.length) {
    return NextResponse.json({ error: "词库为空，请先上传单词表" }, { status: 400 });
  }

  const questions = buildQuestions(words, input);
  const room: DictationRoom = {
    id: shortId(),
    parentToken: token(),
    childToken: token(),
    status: "active",
    totalCount: questions.length,
    mistakeRatio: input.mistakeRatio,
    questionMode: "mixed",
    questions,
    createdAt: new Date().toISOString()
  };

  await createRoom(room);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({
    room,
    parentUrl: `${baseUrl}/parent/${room.id}?token=${room.parentToken}`,
    childUrl: `${baseUrl}/child/${room.id}?token=${room.childToken}`
  });
}
