import { NextResponse } from "next/server";
import { buildWordTemplateWorkbook, writeWorkbookBuffer } from "@/lib/word-template";

export const runtime = "nodejs";

export async function GET() {
  const buffer = writeWorkbookBuffer(buildWordTemplateWorkbook());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="word-template.xlsx"'
    }
  });
}
