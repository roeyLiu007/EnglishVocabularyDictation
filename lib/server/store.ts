import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { applyVerdictToStats } from "@/lib/dictation";
import type { AnswerVerdict, DictationRoom, Question, SubmittedAnswer, WordEntry } from "@/lib/types";
import { effectiveSource, effectiveStages } from "@/lib/vocabulary";

type MemoryStore = {
  words: WordEntry[];
  rooms: DictationRoom[];
  answers: SubmittedAnswer[];
};

declare global {
  // eslint-disable-next-line no-var
  var __dictationMemoryStore: MemoryStore | undefined;
}

const localStorePath = path.join(process.cwd(), "data", "local-store.json");
const supabaseBatchSize = 500;
const supabasePageSize = 1000;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function readLocalStore(): Promise<MemoryStore> {
  if (!globalThis.__dictationMemoryStore) {
    try {
      const content = await readFile(localStorePath, "utf8");
      globalThis.__dictationMemoryStore = JSON.parse(content) as MemoryStore;
    } catch {
      globalThis.__dictationMemoryStore = {
        words: [],
        rooms: [],
        answers: []
      };
    }
  }
  return globalThis.__dictationMemoryStore;
}

async function writeLocalStore(store: MemoryStore) {
  if (process.env.NODE_ENV === "production" && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("线上环境需要先配置 Supabase 环境变量，不能使用本地 JSON 文件保存数据。");
  }
  globalThis.__dictationMemoryStore = store;
  await mkdir(path.dirname(localStorePath), { recursive: true });
  await writeFile(localStorePath, JSON.stringify(store, null, 2), "utf8");
}

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

function mapWord(row: Record<string, unknown>): WordEntry {
  const word: WordEntry = {
    id: String(row.id),
    entryType: row.entry_type === "phrase" ? "phrase" : "word",
    word: String(row.word ?? ""),
    phonetic: String(row.phonetic ?? ""),
    partOfSpeech: String(row.part_of_speech ?? ""),
    meaning: String(row.meaning ?? ""),
    unit: String(row.unit ?? ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    notes: String(row.notes ?? ""),
    stages: Array.isArray(row.stages) ? (row.stages as string[]) : [],
    source: row.source as WordEntry["source"],
    uploadBatchId: String(row.upload_batch_id ?? ""),
    uploadBatchName: String(row.upload_batch_name ?? ""),
    stats: row.stats as WordEntry["stats"],
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
  return hydrateWord(word);
}

function wordRow(word: WordEntry) {
  return {
    id: word.id,
    entry_type: word.entryType ?? "word",
    word: word.word,
    phonetic: word.phonetic ?? "",
    part_of_speech: word.partOfSpeech,
    meaning: word.meaning,
    unit: word.unit ?? "",
    tags: word.tags ?? [],
    notes: word.notes ?? "",
    stages: word.stages ?? [],
    source: word.source ?? "custom",
    upload_batch_id: word.uploadBatchId ?? "",
    upload_batch_name: word.uploadBatchName ?? "",
    stats: word.stats,
    created_at: word.createdAt
  };
}

function hydrateWord(word: WordEntry): WordEntry {
  const stages = effectiveStages(word);
  const baseStats = {
    wrongCount: 0,
    correctCount: 0,
    fieldWrongCounts: {},
    consecutiveCorrect: 0,
    proficiency: "new" as const,
    reviewIntervalDays: 0,
    mistakePeople: {}
  };
  const hydratedStats = { ...baseStats, ...(word.stats ?? {}) };
  if (hydratedStats.wrongCount > 0 && !Object.keys(hydratedStats.mistakePeople ?? {}).length) {
    hydratedStats.mistakePeople = { 未标注: hydratedStats.wrongCount };
  }
  if (!word.stats?.proficiency) {
    hydratedStats.proficiency = hydratedStats.consecutiveCorrect >= 4
      ? "mastered"
      : hydratedStats.consecutiveCorrect >= 2
        ? "review"
        : hydratedStats.wrongCount > 0
          ? "learning"
          : "new";
  }
  return {
    ...word,
    entryType: word.entryType === "phrase" ? "phrase" : "word",
    phonetic: word.phonetic ?? "",
    tags: word.tags ?? [],
    notes: word.notes ?? "",
    stages,
    source: effectiveSource({ ...word, stages }),
    uploadBatchId: word.uploadBatchId ?? "",
    uploadBatchName: word.uploadBatchName ?? "",
    stats: hydratedStats
  };
}

function resetWordStats(word: WordEntry): WordEntry {
  return {
    ...word,
    stats: {
      wrongCount: 0,
      correctCount: 0,
      fieldWrongCounts: {},
      consecutiveCorrect: 0,
      proficiency: "new",
      reviewIntervalDays: 0,
      mistakePeople: {}
    }
  };
}

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;
  const details = Object.values(error as Record<string, unknown>)
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();
  return details.includes(columnName.toLowerCase()) && /column|schema|cache|找不到|不存在/.test(details);
}

function mapRoom(row: Record<string, unknown>): DictationRoom {
  const status = row.status === "completed" || row.status === "recorded" || row.status === "closed" ? row.status : "active";
  const questions = row.questions as DictationRoom["questions"];
  return {
    id: String(row.id),
    parentToken: String(row.parent_token),
    childToken: String(row.child_token),
    status,
    totalCount: Number(row.total_count),
    mistakeRatio: Number(row.mistake_ratio),
    wordSource: row.word_source as DictationRoom["wordSource"],
    stage: String(row.stage ?? ""),
    dictationPerson: questions?.[0]?.dictationPerson ?? "未标注",
    questionMode: "mixed",
    questions,
    createdAt: String(row.created_at)
  };
}

function mapAnswer(row: Record<string, unknown>): SubmittedAnswer {
  return {
    roomId: String(row.room_id),
    questionId: String(row.question_id),
    answer: row.answer as SubmittedAnswer["answer"],
    verdict: row.verdict as SubmittedAnswer["verdict"],
    durationSeconds: typeof row.duration_seconds === "number" ? row.duration_seconds : undefined,
    submittedAt: String(row.submitted_at)
  };
}

function roomRow(room: DictationRoom) {
  return {
    id: room.id,
    parent_token: room.parentToken,
    child_token: room.childToken,
    status: room.status,
    total_count: room.totalCount,
    mistake_ratio: room.mistakeRatio,
    word_source: room.wordSource ?? "all",
    stage: room.stage ?? "",
    question_mode: room.questionMode,
    questions: room.questions,
    created_at: room.createdAt
  };
}

export async function listWords() {
  const client = supabase();
  if (client) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += supabasePageSize) {
      const to = from + supabasePageSize - 1;
      const { data, error } = await client.from("words").select("*").order("created_at", { ascending: false }).range(from, to);
      if (error) throw error;
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < supabasePageSize) break;
    }
    return rows.map(mapWord);
  }

  const store = await readLocalStore();
  return store.words.map(hydrateWord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveWords(words: WordEntry[]) {
  const client = supabase();
  if (client) {
    for (const batch of chunk(words, supabaseBatchSize)) {
      const { error } = await client.from("words").upsert(batch.map(wordRow));
      if (error) throw error;
    }
    return words;
  }

  const store = await readLocalStore();
  const nextById = new Map(store.words.map((word) => [word.id, word]));
  for (const word of words) {
    nextById.set(word.id, word);
  }
  store.words = Array.from(nextById.values());
  await writeLocalStore(store);
  return words;
}

export async function updateWord(word: WordEntry) {
  const client = supabase();
  if (client) {
    const { error } = await client.from("words").upsert(wordRow(word));
    if (error) throw error;
    return word;
  }

  const store = await readLocalStore();
  store.words = store.words.map((item) => (item.id === word.id ? word : item));
  await writeLocalStore(store);
  return word;
}

export async function deleteWord(wordId: string) {
  const client = supabase();
  if (client) {
    const { error } = await client.from("words").delete().eq("id", wordId);
    if (error) throw error;
    return { id: wordId };
  }

  const store = await readLocalStore();
  store.words = store.words.filter((word) => word.id !== wordId);
  await writeLocalStore(store);
  return { id: wordId };
}

export async function deleteWords(wordIds: string[]) {
  if (!wordIds.length) return { deletedCount: 0 };

  const client = supabase();
  if (client) {
    for (const batch of chunk(wordIds, supabaseBatchSize)) {
      const { error } = await client.from("words").delete().in("id", batch);
      if (error) throw error;
    }
    return { deletedCount: wordIds.length };
  }

  const deleteIds = new Set(wordIds);
  const store = await readLocalStore();
  const beforeCount = store.words.length;
  store.words = store.words.filter((word) => !deleteIds.has(word.id));
  await writeLocalStore(store);
  return { deletedCount: beforeCount - store.words.length };
}

export async function clearMistake(wordId: string) {
  const words = await listWords();
  const existing = words.find((word) => word.id === wordId);
  if (!existing) return null;

  const updated = resetWordStats(existing);
  await updateWord(updated);
  return updated;
}

export async function clearAllMistakes() {
  const words = await listWords();
  const updated = words.map((word) => (word.stats.wrongCount > 0 ? resetWordStats(word) : word));
  const changed = updated.filter((word, index) => word !== words[index]);

  for (const word of changed) {
    await updateWord(word);
  }

  return { clearedCount: changed.length };
}

export async function createRoom(room: DictationRoom) {
  const client = supabase();
  if (client) {
    const { error } = await client.from("dictation_rooms").insert(roomRow(room));
    if (error) throw error;
    return room;
  }

  const store = await readLocalStore();
  store.rooms.push(room);
  await writeLocalStore(store);
  return room;
}

export async function getRoom(roomId: string) {
  const client = supabase();
  if (client) {
    const { data, error } = await client.from("dictation_rooms").select("*").eq("id", roomId).single();
    if (error) return null;
    return mapRoom(data);
  }

  const store = await readLocalStore();
  return store.rooms.find((room) => room.id === roomId) ?? null;
}

export async function listRooms() {
  const client = supabase();
  if (client) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += supabasePageSize) {
      const to = from + supabasePageSize - 1;
      const { data, error } = await client
        .from("dictation_rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < supabasePageSize) break;
    }
    return rows.map(mapRoom);
  }

  const store = await readLocalStore();
  return [...store.rooms].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAnswersForRooms(roomIds: string[]) {
  if (!roomIds.length) return [];

  const client = supabase();
  if (client) {
    const rows: Record<string, unknown>[] = [];
    for (const roomIdBatch of chunk(roomIds, supabaseBatchSize)) {
      for (let from = 0; ; from += supabasePageSize) {
        const to = from + supabasePageSize - 1;
        const { data, error } = await client
          .from("dictation_answers")
          .select("*")
          .in("room_id", roomIdBatch)
          .order("submitted_at", { ascending: true })
          .range(from, to);
        if (error) throw error;
        rows.push(...((data ?? []) as Record<string, unknown>[]));
        if (!data || data.length < supabasePageSize) break;
      }
    }
    return rows.map(mapAnswer);
  }

  const roomIdSet = new Set(roomIds);
  const store = await readLocalStore();
  return store.answers.filter((answer) => roomIdSet.has(answer.roomId));
}

export async function listAnswers(roomId: string) {
  const client = supabase();
  if (client) {
    const { data, error } = await client
      .from("dictation_answers")
      .select("*")
      .eq("room_id", roomId)
      .order("submitted_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapAnswer(row as Record<string, unknown>));
  }

  const store = await readLocalStore();
  return store.answers.filter((answer) => answer.roomId === roomId);
}

export async function saveAnswer(answer: SubmittedAnswer) {
  const client = supabase();
  if (client) {
    const answerRow = {
      room_id: answer.roomId,
      question_id: answer.questionId,
      answer: answer.answer,
      verdict: answer.verdict,
      duration_seconds: answer.durationSeconds ?? null,
      submitted_at: answer.submittedAt
    };
    const { error } = await client.from("dictation_answers").upsert(answerRow);
    if (error) {
      if (isMissingColumnError(error, "duration_seconds")) {
        const { duration_seconds: _durationSeconds, ...legacyAnswerRow } = answerRow;
        const { error: retryError } = await client.from("dictation_answers").upsert(legacyAnswerRow);
        if (retryError) throw retryError;
        return { ...answer, durationSeconds: undefined };
      }
      throw error;
    }
  } else {
    const store = await readLocalStore();
    store.answers = store.answers.filter((item) => item.roomId !== answer.roomId || item.questionId !== answer.questionId);
    store.answers.push(answer);
    await writeLocalStore(store);
  }

  return answer;
}

export async function completeRoom(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.status === "closed") throw new Error("本次听写已关闭，不能再结束或写入错词本");
  if (room.status === "recorded") return room;

  const completed: DictationRoom = { ...room, status: "completed" };

  const client = supabase();
  if (client) {
    const { error } = await client.from("dictation_rooms").update({ status: "completed" }).eq("id", roomId);
    if (error) throw error;
    return completed;
  }

  const store = await readLocalStore();
  store.rooms = store.rooms.map((item) => (item.id === roomId ? completed : item));
  await writeLocalStore(store);
  return completed;
}

export async function recordRoomMistakes(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.status === "recorded") return room;
  if (room.status !== "completed" && room.status !== "closed") throw new Error("请先结束听写，再记录到错题本");
  if (!room.questions.some((question) => question.manualMistakeRecording)) {
    throw new Error("该历史任务已经按旧规则记录过错题，不能重复记录");
  }

  const answers = await listAnswers(roomId);
  if (answers.some((answer) => answer.verdict.overall === "pending")) {
    throw new Error("还有待确认答案，请先逐题判定为正确或错误");
  }
  const words = await listWords();
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  const teacherEndedEarly = room.status === "closed";
  const missingVerdict = (question: Question): AnswerVerdict => ({
    overall: "wrong",
    fields: Object.fromEntries(question.targetFields.map((field) => [field, {
      status: "wrong",
      expected: question.answer[field === "partOfSpeech" ? "partOfSpeech" : field],
      received: "",
      note: "学生交卷时未提交本题"
    }]))
  });

  for (const question of room.questions) {
    const submitted = answerMap.get(question.id);
    if (!submitted && teacherEndedEarly) continue;
    const verdict = submitted?.verdict ?? missingVerdict(question);
    const word = words.find((item) => item.id === question.wordId);
    if (!word) continue;
    let updated = applyVerdictToStats(word, verdict);
    if (verdict.overall === "wrong") {
      const person = room.dictationPerson || question?.dictationPerson || "未标注";
      updated = {
        ...updated,
        stats: {
          ...updated.stats,
          mistakePeople: {
            ...(updated.stats.mistakePeople ?? {}),
            [person]: (updated.stats.mistakePeople?.[person] ?? 0) + 1
          }
        }
      };
    }
    await updateWord(updated);
    const index = words.findIndex((item) => item.id === word.id);
    if (index >= 0) words[index] = updated;
  }

  const recorded: DictationRoom = { ...room, status: "recorded" };
  const client = supabase();
  if (client) {
    const { error } = await client.from("dictation_rooms").update({ status: "recorded" }).eq("id", roomId);
    if (error) throw error;
    return recorded;
  }
  const store = await readLocalStore();
  store.rooms = store.rooms.map((item) => (item.id === roomId ? recorded : item));
  await writeLocalStore(store);
  return recorded;
}

export async function closeRoom(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.status !== "active") return room;

  const closed: DictationRoom = { ...room, status: "closed" };
  const client = supabase();
  if (client) {
    const { error } = await client
      .from("dictation_rooms")
      .update({ status: "closed" })
      .eq("id", roomId)
      .eq("status", "active");
    if (error) throw error;
    return closed;
  }

  const store = await readLocalStore();
  store.rooms = store.rooms.map((item) => (item.id === roomId && item.status === "active" ? closed : item));
  await writeLocalStore(store);
  return closed;
}
