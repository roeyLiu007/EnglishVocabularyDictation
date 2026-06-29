import { NextResponse } from "next/server";
import { clearAllMistakes } from "@/lib/server/store";

export async function DELETE() {
  const result = await clearAllMistakes();
  return NextResponse.json(result);
}
