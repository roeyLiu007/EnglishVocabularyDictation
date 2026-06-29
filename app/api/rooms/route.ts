import { NextResponse } from "next/server";
import { buildQuestions } from "@/lib/dictation";
import { createRoom, listWords } from "@/lib/server/store";
import type { CreateRoomInput, DictationRoom } from "@/lib/types";
import { normalizeStage, stageLabel } from "@/lib/vocabulary";

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  const input = (await request.json()) as CreateRoomInput;
  const allWords = await listWords();
  const source = input.wordSource ?? "all";
  const stage = normalizeStage(input.stage ?? "");
  const latestBatchId =
    allWords
      .map((word) => word.uploadBatchId)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "";
  const words = allWords.filter((word) => {
    if (source === "stage") return Boolean(stage) && (word.stages ?? []).includes(stage);
    if (source === "latestUpload") return Boolean(latestBatchId) && word.uploadBatchId === latestBatchId;
    return true;
  });

  if (!words.length) {
    const error =
      source === "stage"
        ? `${stage ? stageLabel(stage) : "所选阶段"}词库为空，请先上传模板并更新这个基础词汇表`
        : source === "latestUpload"
          ? "最近一次上传为空，请先上传模板"
          : "词库为空，请先上传单词表";
    return NextResponse.json({ error }, { status: 400 });
  }

  const questions = buildQuestions(words, input);
  const room: DictationRoom = {
    id: shortId(),
    parentToken: token(),
    childToken: token(),
    status: "active",
    totalCount: questions.length,
    mistakeRatio: input.mistakeRatio,
    wordSource: source,
    stage,
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
