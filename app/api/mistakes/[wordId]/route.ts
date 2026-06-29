import { NextResponse } from "next/server";
import { clearMistake } from "@/lib/server/store";

type RouteContext = {
  params: {
    wordId: string;
  };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const word = await clearMistake(params.wordId);
  if (!word) {
    return NextResponse.json({ error: "没有找到这个单词" }, { status: 404 });
  }

  return NextResponse.json({ word });
}
