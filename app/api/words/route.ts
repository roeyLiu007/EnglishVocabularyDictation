import { NextResponse } from "next/server";
import { makeWordEntry, normalizeWord } from "@/lib/dictation";
import { deleteWords, listWords, saveWords } from "@/lib/server/store";
import type { ImportPreviewWord, WordEntry } from "@/lib/types";
import { normalizeStage, stageLabel } from "@/lib/vocabulary";

type ClearWordsRequest = {
  mode?: "stage" | "source" | "uploadBatch";
  value?: string;
};

export async function GET() {
  const words = await listWords();
  return NextResponse.json({ words });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      words?: ImportPreviewWord[];
      saveMode?: "recent" | "stage";
      stage?: string;
      batchName?: string;
    };
    const saveMode = body.saveMode ?? "recent";
    const selectedStage = normalizeStage(body.stage ?? "");
    if (saveMode === "stage" && !selectedStage) {
      return NextResponse.json({ error: "请选择要更新的基础词汇表" }, { status: 400 });
    }

    const batchId = `upload-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const batchName =
      body.batchName?.trim() || `${saveMode === "stage" ? stageLabel(selectedStage) : "本次上传"} ${new Date().toLocaleString("zh-CN")}`;
    const existingWords = await listWords();
    const existingByWord = new Map(existingWords.map((word) => [normalizeWord(word.word), word]));

    const prepared: WordEntry[] = (body.words ?? [])
      .filter((word) => word.word?.trim() && word.meaning?.trim())
      .map((word) => {
        const entry = makeWordEntry(word);
        const stages = [...(entry.stages ?? [])];
        if (selectedStage && !stages.includes(selectedStage)) stages.push(selectedStage);
        return {
          ...entry,
          stages,
          source: saveMode === "stage" ? ("base" as const) : ("upload" as const),
          uploadBatchId: batchId,
          uploadBatchName: batchName
        };
      });

    if (!prepared.length) {
      return NextResponse.json({ error: "没有可保存的单词" }, { status: 400 });
    }

    if (saveMode === "recent") {
      await saveWords(prepared);
      return NextResponse.json({ words: prepared, batchId, batchName, updatedCount: 0, createdCount: prepared.length });
    }

    const created: WordEntry[] = [];
    const updated: WordEntry[] = [];
    for (const entry of prepared) {
      const existing = existingByWord.get(normalizeWord(entry.word));
      if (existing) {
        const stages = Array.from(new Set([...(existing.stages ?? []), ...(entry.stages ?? [])]));
        const tags = Array.from(new Set([...(existing.tags ?? []), ...(entry.tags ?? [])]));
        const next = {
          ...existing,
          entryType: entry.entryType,
          word: entry.word,
          phonetic: entry.phonetic || existing.phonetic,
          partOfSpeech: entry.partOfSpeech,
          meaning: entry.meaning,
          unit: entry.unit || existing.unit,
          tags,
          notes: entry.notes || existing.notes,
          stages,
          source: "base" as const,
          uploadBatchId: batchId,
          uploadBatchName: batchName
        };
        updated.push(next);
        existingByWord.set(normalizeWord(next.word), next);
      } else {
        created.push(entry);
        existingByWord.set(normalizeWord(entry.word), entry);
      }
    }

    await saveWords([...updated, ...created]);

    return NextResponse.json({
      words: [...updated, ...created],
      batchId,
      batchName,
      updatedCount: updated.length,
      createdCount: created.length
    });
  } catch (error) {
    console.error("[api/words] failed to save words", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败，请稍后重试" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as ClearWordsRequest;
    const words = await listWords();

    if (body.mode === "stage") {
      const stage = normalizeStage(body.value ?? "");
      if (!stage) {
        return NextResponse.json({ error: "请选择要清空的阶段词库" }, { status: 400 });
      }

      const matched = words.filter((word) => (word.stages ?? []).includes(stage));
      const toUpdate = matched
        .map((word) => ({ ...word, stages: (word.stages ?? []).filter((item) => item !== stage) }))
        .filter((word) => word.stages.length > 0);
      const toDelete = matched.filter((word) => (word.stages ?? []).filter((item) => item !== stage).length === 0);
      const deleteIds = new Set(toDelete.map((word) => word.id));
      const updateById = new Map(toUpdate.map((word) => [word.id, word]));

      await saveWords(toUpdate);
      await deleteWords(toDelete.map((word) => word.id));

      return NextResponse.json({
        deletedCount: toDelete.length,
        updatedCount: toUpdate.length,
        matchedCount: matched.length,
        words: words.filter((word) => !deleteIds.has(word.id)).map((word) => updateById.get(word.id) ?? word)
      });
    }

    if (body.mode === "source") {
      const source = body.value === "base" || body.value === "upload" || body.value === "custom" ? body.value : "";
      if (!source) {
        return NextResponse.json({ error: "请选择要清空的来源类型" }, { status: 400 });
      }

      const matched = words.filter((word) => (word.source ?? "custom") === source);
      const deleteIds = new Set(matched.map((word) => word.id));
      await deleteWords(matched.map((word) => word.id));

      return NextResponse.json({
        deletedCount: matched.length,
        updatedCount: 0,
        matchedCount: matched.length,
        words: words.filter((word) => !deleteIds.has(word.id))
      });
    }

    if (body.mode === "uploadBatch") {
      const uploadBatchId = body.value?.trim();
      if (!uploadBatchId) {
        return NextResponse.json({ error: "请选择要清空的上传批次" }, { status: 400 });
      }

      const matched = words.filter((word) => word.uploadBatchId === uploadBatchId);
      const deleteIds = new Set(matched.map((word) => word.id));
      await deleteWords(matched.map((word) => word.id));

      return NextResponse.json({
        deletedCount: matched.length,
        updatedCount: 0,
        matchedCount: matched.length,
        words: words.filter((word) => !deleteIds.has(word.id))
      });
    }

    return NextResponse.json({ error: "请选择清空方式" }, { status: 400 });
  } catch (error) {
    console.error("[api/words] failed to clear words", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "清空失败，请稍后重试" }, { status: 400 });
  }
}
