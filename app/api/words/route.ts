import { NextResponse } from "next/server";
import { makeWordEntry } from "@/lib/dictation";
import { listWords, saveWords } from "@/lib/server/store";
import type { ImportPreviewWord } from "@/lib/types";

export async function GET() {
  const words = await listWords();
  return NextResponse.json({ words });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { words?: ImportPreviewWord[] };
  const words = (body.words ?? [])
    .filter((word) => word.word?.trim() && word.meaning?.trim())
    .map((word) => makeWordEntry(word));

  if (!words.length) {
    return NextResponse.json({ error: "没有可保存的单词" }, { status: 400 });
  }

  await saveWords(words);
  return NextResponse.json({ words });
}
