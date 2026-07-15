import { NextResponse } from "next/server";
import { CLOUD_SPEECH_VOICES } from "@/lib/cloud-speech";
import { speechTextForWord } from "@/lib/dictation";
import { cachedSpeechUrl } from "@/lib/server/cloud-tts";
import { listWords } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return String(record.message || record.details || record.code || "云端发音暂不可用");
  }
  return "云端发音暂不可用";
}

export async function GET(request: Request, { params }: { params: { wordId: string } }) {
  try {
    const word = (await listWords()).find((item) => item.id === params.wordId);
    if (!word) return NextResponse.json({ error: "单词不存在" }, { status: 404 });

    const voiceId = new URL(request.url).searchParams.get("voice");
    const voice = CLOUD_SPEECH_VOICES.find((item) => item.id === voiceId);
    if (!voice) return NextResponse.json({ error: "不支持的声音" }, { status: 400 });

    const text = speechTextForWord(word.word);
    if (!text || text.length > 500) return NextResponse.json({ error: "发音文本无效" }, { status: 400 });

    const url = await cachedSpeechUrl(text, voice.id);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("[api/words/:wordId/speech] failed to load speech", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}
