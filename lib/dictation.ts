import type {
  AnswerInput,
  AnswerVerdict,
  CreateRoomInput,
  FieldName,
  FieldStatus,
  ImportPreviewWord,
  PromptType,
  Question,
  WordEntry,
  WordStats
} from "./types";

export const defaultStats = (): WordStats => ({
  wrongCount: 0,
  correctCount: 0,
  fieldWrongCounts: {},
  consecutiveCorrect: 0
});

const posAliases: Record<string, string> = {
  n: "noun",
  "n.": "noun",
  noun: "noun",
  名词: "noun",
  v: "verb",
  "v.": "verb",
  verb: "verb",
  动词: "verb",
  adj: "adjective",
  "adj.": "adjective",
  adjective: "adjective",
  形容词: "adjective",
  adv: "adverb",
  "adv.": "adverb",
  adverb: "adverb",
  副词: "adverb",
  prep: "preposition",
  "prep.": "preposition",
  preposition: "preposition",
  介词: "preposition",
  pron: "pronoun",
  "pron.": "pronoun",
  pronoun: "pronoun",
  代词: "pronoun",
  conj: "conjunction",
  "conj.": "conjunction",
  conjunction: "conjunction",
  连词: "conjunction",
  interj: "interjection",
  "interj.": "interjection",
  感叹词: "interjection"
};

export function normalizeWord(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePartOfSpeech(value = "") {
  const normalized = value.trim().toLowerCase().replace(/[。；;,，]/g, "").replace(/\s+/g, " ");
  return posAliases[normalized] ?? normalized;
}

export function speechTextForWord(value = "") {
  const cleaned = value
    .trim()
    .replace(/[（(].*$/, "")
    .replace(/[=\/].*$/, "")
    .replace(/[^A-Za-z' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || value.trim();
}

function normalizeMeaning(value = "") {
  return value
    .trim()
    .replace(/[，。；;、]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function fieldVerdict(status: FieldStatus, expected: string, received: string, note?: string) {
  return { status, expected, received, note };
}

export function gradeAnswer(question: Question, input: AnswerInput): AnswerVerdict {
  const fields: AnswerVerdict["fields"] = {};

  if (question.targetFields.includes("word")) {
    const expected = normalizeWord(question.answer.word);
    const received = normalizeWord(input.word);
    fields.word = fieldVerdict(received === expected ? "correct" : "wrong", question.answer.word, input.word ?? "");
  }

  if (question.targetFields.includes("partOfSpeech")) {
    const expected = normalizePartOfSpeech(question.answer.partOfSpeech);
    const received = normalizePartOfSpeech(input.partOfSpeech);
    fields.partOfSpeech = fieldVerdict(
      received === expected ? "correct" : "wrong",
      question.answer.partOfSpeech,
      input.partOfSpeech ?? ""
    );
  }

  if (question.targetFields.includes("meaning")) {
    const expected = normalizeMeaning(question.answer.meaning);
    const received = normalizeMeaning(input.meaning);
    let status: FieldStatus = "wrong";
    let note: string | undefined;

    if (received && (expected === received || expected.includes(received) || received.includes(expected))) {
      status = "correct";
    } else if (received) {
      status = "pending";
      note = "中文释义可能存在同义表达，需要家长确认";
    }

    fields.meaning = fieldVerdict(status, question.answer.meaning, input.meaning ?? "", note);
  }

  const statuses = Object.values(fields).map((field) => field.status);
  const overall: FieldStatus = statuses.includes("wrong")
    ? "wrong"
    : statuses.includes("pending")
      ? "pending"
      : "correct";

  return { overall, fields };
}

export function applyVerdictToStats(word: WordEntry, verdict: AnswerVerdict): WordEntry {
  const now = new Date().toISOString();
  const wrongFields = Object.entries(verdict.fields)
    .filter(([, field]) => field?.status === "wrong" || field?.status === "pending")
    .map(([field]) => field as FieldName);

  const stats: WordStats = {
    ...word.stats,
    lastTestedAt: now,
    fieldWrongCounts: { ...word.stats.fieldWrongCounts }
  };

  if (wrongFields.length === 0) {
    stats.correctCount += 1;
    stats.consecutiveCorrect += 1;
  } else {
    stats.wrongCount += 1;
    stats.consecutiveCorrect = 0;
    stats.lastWrongAt = now;
    wrongFields.forEach((field) => {
      stats.fieldWrongCounts[field] = (stats.fieldWrongCounts[field] ?? 0) + 1;
    });
  }

  return { ...word, stats };
}

function mistakeWeight(word: WordEntry) {
  const stats = word.stats;
  if (stats.wrongCount <= 0) return 0;
  const fieldPenalty = Object.values(stats.fieldWrongCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const recovery = Math.min(stats.consecutiveCorrect, 3) * 2;
  return Math.max(1, stats.wrongCount * 4 + fieldPenalty - recovery);
}

function takeWeighted(words: WordEntry[], count: number) {
  const pool = words.map((word) => ({ word, weight: mistakeWeight(word) || 1 }));
  const selected: WordEntry[] = [];

  while (pool.length && selected.length < count) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    const index = pool.findIndex((item) => {
      cursor -= item.weight;
      return cursor <= 0;
    });
    const [picked] = pool.splice(index >= 0 ? index : pool.length - 1, 1);
    selected.push(picked.word);
  }

  return selected;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeQuestion(word: WordEntry, index: number): Question {
  const promptTypes: PromptType[] = ["audio", "english", "chinese"];
  const promptType = promptTypes[index % promptTypes.length];
  const id = `${word.id}-${promptType}-${Date.now()}-${index}`;

  if (promptType === "audio") {
    return {
      id,
      wordId: word.id,
      promptType,
      prompt: "听英文发音，填写词性、英文和中文意思",
      speechText: speechTextForWord(word.word),
      targetFields: ["partOfSpeech", "word", "meaning"],
      answer: {
        word: word.word,
        partOfSpeech: word.partOfSpeech,
        meaning: word.meaning
      }
    };
  }

  if (promptType === "english") {
    return {
      id,
      wordId: word.id,
      promptType,
      prompt: word.word,
      targetFields: ["partOfSpeech", "meaning"],
      answer: {
        word: word.word,
        partOfSpeech: word.partOfSpeech,
        meaning: word.meaning
      }
    };
  }

  return {
    id,
    wordId: word.id,
    promptType,
    prompt: word.meaning,
    targetFields: ["partOfSpeech", "word"],
    answer: {
      word: word.word,
      partOfSpeech: word.partOfSpeech,
      meaning: word.meaning
    }
  };
}

export function buildQuestions(words: WordEntry[], input: CreateRoomInput) {
  const totalCount = Math.max(1, Math.min(input.totalCount, words.length));
  const mistakeCount = Math.min(
    Math.round(totalCount * (Math.max(0, Math.min(input.mistakeRatio, 100)) / 100)),
    words.filter((word) => word.stats.wrongCount > 0).length
  );

  const mistakes = takeWeighted(
    words.filter((word) => word.stats.wrongCount > 0),
    mistakeCount
  );
  const mistakeIds = new Set(mistakes.map((word) => word.id));
  const ordinary = shuffle(words.filter((word) => !mistakeIds.has(word.id))).slice(0, totalCount - mistakes.length);
  const selected = shuffle([...mistakes, ...ordinary]).slice(0, totalCount);

  return selected.map(makeQuestion);
}

export function parseWordListText(text: string): ImportPreviewWord[] {
  const posPattern =
    "(n\\.|noun|v\\.|verb|adj\\.|adjective|adv\\.|adverb|prep\\.|preposition|pron\\.|pronoun|conj\\.|conjunction|interj\\.|名词|动词|形容词|副词|介词|代词|连词|感叹词)";

  const parsed = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)、\s-]*/, "").replace(/\s+/g, " "))
    .map((line) => {
      const match = line.match(new RegExp(`^([A-Za-z][A-Za-z\\-']*)\\s+(?:/[^/]+/\\s+)?${posPattern}\\s+(.+)$`, "i"));
      if (match) {
        return {
          word: match[1],
          partOfSpeech: match[2],
          meaning: match[3],
          unit: ""
        };
      }

      const loose = line.match(/^([A-Za-z][A-Za-z\-']*)\s+(.+[\u4e00-\u9fa5].*)$/);
      if (loose) {
        return {
          word: loose[1],
          partOfSpeech: "",
          meaning: loose[2],
          unit: ""
        };
      }

      return null;
    })
    .filter((word): word is Required<ImportPreviewWord> => Boolean(word?.word && word.meaning));

  return parsed;
}

export function makeWordEntry(input: ImportPreviewWord): WordEntry {
  return {
    id: crypto.randomUUID(),
    word: input.word.trim(),
    partOfSpeech: input.partOfSpeech.trim(),
    meaning: input.meaning.trim(),
    unit: input.unit?.trim() ?? "",
    tags: [],
    stats: defaultStats(),
    createdAt: new Date().toISOString()
  };
}
