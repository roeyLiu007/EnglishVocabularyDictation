import { NextResponse } from "next/server";
import { parseWordListText } from "@/lib/dictation";

export const runtime = "nodejs";

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (name.endsWith(".txt") || name.endsWith(".csv")) {
    return buffer.toString("utf8");
  }

  throw new Error("暂时只支持 docx、文字型 pdf、txt、csv");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const text = await extractText(file);
    const words = parseWordListText(text);
    return NextResponse.json({ words, rawTextLength: text.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "解析失败" }, { status: 400 });
  }
}
