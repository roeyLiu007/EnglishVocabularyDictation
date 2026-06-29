import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { applyVerdictToStats } from "@/lib/dictation";
import type { DictationRoom, SubmittedAnswer, WordEntry } from "@/lib/types";

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
  return {
    id: String(row.id),
    word: String(row.word ?? ""),
    partOfSpeech: String(row.part_of_speech ?? ""),
    meaning: String(row.meaning ?? ""),
    unit: String(row.unit ?? ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    stats: row.stats as WordEntry["stats"],
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}

function wordRow(word: WordEntry) {
  return {
    id: word.id,
    word: word.word,
    part_of_speech: word.partOfSpeech,
    meaning: word.meaning,
    unit: word.unit ?? "",
    tags: word.tags ?? [],
    stats: word.stats,
    created_at: word.createdAt
  };
}

function mapRoom(row: Record<string, unknown>): DictationRoom {
  return {
    id: String(row.id),
    parentToken: String(row.parent_token),
    childToken: String(row.child_token),
    status: row.status as DictationRoom["status"],
    totalCount: Number(row.total_count),
    mistakeRatio: Number(row.mistake_ratio),
    questionMode: "mixed",
    questions: row.questions as DictationRoom["questions"],
    createdAt: String(row.created_at)
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
    question_mode: room.questionMode,
    questions: room.questions,
    created_at: room.createdAt
  };
}

export async function listWords() {
  const client = supabase();
  if (client) {
    const { data, error } = await client.from("words").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapWord);
  }

  const store = await readLocalStore();
  return [...store.words].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveWords(words: WordEntry[]) {
  const client = supabase();
  if (client) {
    const { error } = await client.from("words").upsert(words.map(wordRow));
    if (error) throw error;
    return words;
  }

  const store = await readLocalStore();
  const existingIds = new Set(store.words.map((word) => word.id));
  store.words.push(...words.filter((word) => !existingIds.has(word.id)));
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

export async function listAnswers(roomId: string) {
  const client = supabase();
  if (client) {
    const { data, error } = await client
      .from("dictation_answers")
      .select("*")
      .eq("room_id", roomId)
      .order("submitted_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      roomId: String(row.room_id),
      questionId: String(row.question_id),
      answer: row.answer,
      verdict: row.verdict,
      submittedAt: String(row.submitted_at)
    })) as SubmittedAnswer[];
  }

  const store = await readLocalStore();
  return store.answers.filter((answer) => answer.roomId === roomId);
}

export async function saveAnswer(answer: SubmittedAnswer) {
  const client = supabase();
  if (client) {
    const { error } = await client.from("dictation_answers").upsert({
      room_id: answer.roomId,
      question_id: answer.questionId,
      answer: answer.answer,
      verdict: answer.verdict,
      submitted_at: answer.submittedAt
    });
    if (error) throw error;
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
  if (room.status !== "completed") {
    const answers = await listAnswers(roomId);
    const words = await listWords();

    for (const answer of answers) {
      const question = room.questions.find((item) => item.id === answer.questionId);
      const word = question ? words.find((item) => item.id === question.wordId) : null;
      if (word) {
        const updated = applyVerdictToStats(word, answer.verdict);
        await updateWord(updated);
        const index = words.findIndex((item) => item.id === word.id);
        if (index >= 0) words[index] = updated;
      }
    }
  }

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
