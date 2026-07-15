import { NextResponse } from "next/server";
import { formatPartOfSpeech } from "@/lib/dictation";
import { deleteWord, listWords, updateWord } from "@/lib/server/store";
import type { ImportPreviewWord, WordEntry } from "@/lib/types";
import { normalizeStage } from "@/lib/vocabulary";
import { isAdminRequest } from "@/lib/server/admin-auth";

type RouteContext = {
  params: {
    wordId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "只有教师可以修改单词" }, { status: 401 });
  const words = await listWords();
  const existing = words.find((word) => word.id === params.wordId);
  if (!existing) {
    return NextResponse.json({ error: "没有找到这个单词" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<ImportPreviewWord>;
  const nextWord = body.word?.trim();
  const nextMeaning = body.meaning?.trim();

  if (!nextWord || !nextMeaning) {
    return NextResponse.json({ error: "英文和中文意思不能为空" }, { status: 400 });
  }

  const word: WordEntry = {
    ...existing,
    entryType: body.entryType === "phrase" ? "phrase" : "word",
    word: nextWord,
    phonetic: body.phonetic?.trim() ?? "",
    partOfSpeech: formatPartOfSpeech(body.partOfSpeech ?? "", nextWord),
    meaning: nextMeaning,
    unit: body.unit?.trim() ?? "",
    tags: body.tags ?? [],
    notes: body.notes?.trim() ?? "",
    stages: (body.stages ?? existing.stages ?? []).map(normalizeStage).filter(Boolean)
  };

  await updateWord(word);
  return NextResponse.json({ word });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "只有教师可以删除单词" }, { status: 401 });
  const words = await listWords();
  if (!words.some((word) => word.id === params.wordId)) {
    return NextResponse.json({ error: "没有找到这个单词" }, { status: 404 });
  }

  await deleteWord(params.wordId);
  return NextResponse.json({ id: params.wordId });
}
