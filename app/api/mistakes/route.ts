import { NextResponse } from "next/server";
import { clearAllMistakes } from "@/lib/server/store";
import { isAdminRequest } from "@/lib/server/admin-auth";

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "只有教师可以清空错词本" }, { status: 401 });
  const result = await clearAllMistakes();
  return NextResponse.json(result);
}
