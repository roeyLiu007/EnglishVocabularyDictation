import { NextResponse } from "next/server";
import { CLOUD_SPEECH_VOICES } from "@/lib/cloud-speech";
import { speechTextForWord } from "@/lib/dictation";
import { cachedSpeechUrl } from "@/lib/server/cloud-tts";
import { getRoom } from "@/lib/server/store";

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

export async function GET(request: Request, { params }: { params: { roomId: string; questionId: string } }) {
  try {
    const room = await getRoom(params.roomId);
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });

    const searchParams = new URL(request.url).searchParams;
    const token = searchParams.get("token");
    if (token !== room.childToken && token !== room.parentToken) {
      return NextResponse.json({ error: "链接无效或已过期" }, { status: 403 });
    }

    const question = room.questions.find((item) => item.id === params.questionId);
    if (!question || question.promptType !== "audio") {
      return NextResponse.json({ error: "听力题不存在" }, { status: 404 });
    }

    const voice = CLOUD_SPEECH_VOICES.find((item) => item.id === searchParams.get("voice"));
    if (!voice) return NextResponse.json({ error: "不支持的声音" }, { status: 400 });

    const text = speechTextForWord(question.speechText || question.answer.word);
    if (!text || text.length > 500) {
      return NextResponse.json({ error: "发音文本无效" }, { status: 400 });
    }

    const url = await cachedSpeechUrl(text, voice.id);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("[api/rooms/:roomId/speech/:questionId] failed to load speech", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}
