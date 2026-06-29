import { NextResponse } from "next/server";
import { parseWordTemplate } from "@/lib/word-template";

export const runtime = "nodejs";

async function extractWords(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
    return parseWordTemplate(buffer, file.name);
  }

  throw new Error("请使用固定模板上传，仅支持 .xlsx 或 .csv");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const words = await extractWords(file);
    return NextResponse.json({ words });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "解析失败" }, { status: 400 });
  }
}
