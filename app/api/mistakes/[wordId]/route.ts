import { NextResponse } from "next/server";
import { clearMistake } from "@/lib/server/store";
import { isAdminRequest } from "@/lib/server/admin-auth";

type RouteContext = {
  params: {
    wordId: string;
  };
};

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "只有教师可以删除错词记录" }, { status: 401 });
  const word = await clearMistake(params.wordId);
  if (!word) {
    return NextResponse.json({ error: "没有找到这个单词" }, { status: 404 });
  }

  return NextResponse.json({ word });
}
