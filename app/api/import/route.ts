import { NextResponse } from "next/server";
import { parseWordTemplate } from "@/lib/word-template";

export const runtime = "nodejs";
const maxUploadBytes = 8 * 1024 * 1024;

async function extractWords(file: File) {
  if (!file.size) {
    throw new Error("上传的文件是空的，请重新选择 Excel 模板");
  }
  if (file.size > maxUploadBytes) {
    throw new Error("文件太大了，请控制在 8MB 以内再上传");
  }

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
    console.error("[api/import] failed to parse upload", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "解析失败，请检查模板格式" }, { status: 400 });
  }
}
