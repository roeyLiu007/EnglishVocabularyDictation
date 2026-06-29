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

const partOfSpeechDefinitions = [
  { key: "art", abbr: "art", label: "冠词", aliases: ["art", "article", "冠词"] },
  { key: "phrase", abbr: "phrase", label: "短语", aliases: ["phrase", "phr", "短语", "词组"] },
  { key: "vt", abbr: "vt", label: "及物动词", aliases: ["vt", "transitiveverb", "及物动词"] },
  { key: "vi", abbr: "vi", label: "不及物动词", aliases: ["vi", "intransitiveverb", "不及物动词"] },
  { key: "vlink", abbr: "vlink", label: "系动词", aliases: ["vlink", "linkv", "linkingverb", "系动词", "连系动词"] },
  { key: "n", abbr: "n", label: "名词", aliases: ["n", "noun", "名词"] },
  { key: "adj", abbr: "adj", label: "形容词", aliases: ["a", "adj", "adjective", "形容词"] },
  { key: "adv", abbr: "adv", label: "副词", aliases: ["ad", "adv", "adverb", "副词"] },
  { key: "prep", abbr: "prep", label: "介词", aliases: ["prep", "preposition", "介词"] },
  { key: "pron", abbr: "pron", label: "代词", aliases: ["pron", "pronoun", "代词"] },
  { key: "conj", abbr: "conj", label: "连词", aliases: ["conj", "conjunction", "连词"] },
  { key: "num", abbr: "num", label: "数词", aliases: ["num", "number", "numeral", "数词"] },
  { key: "interj", abbr: "interj", label: "感叹词", aliases: ["int", "interj", "interjection", "感叹词"] },
  { key: "aux", abbr: "aux_v", label: "助动词", aliases: ["aux", "auxv", "auxiliaryverb", "助动词"] },
  { key: "modal", abbr: "aux_v", label: "情态动词", aliases: ["modal", "modalv", "modelv", "modalverb", "情态动词"] },
  { key: "abbr", abbr: "abbr", label: "缩写", aliases: ["abbr", "abbreviation", "缩写"] }
] as const;

type PartOfSpeechKey = (typeof partOfSpeechDefinitions)[number]["key"];

const posAliasToKey = partOfSpeechDefinitions.reduce<Record<string, PartOfSpeechKey>>((aliases, definition) => {
  definition.aliases.forEach((alias) => {
    aliases[alias] = definition.key;
  });
  return aliases;
}, {});

const genericVerbAliases = new Set(["v", "verb", "动词"]);

const genericVerbTransitivity: Record<string, PartOfSpeechKey | PartOfSpeechKey[]> = {
  act: "vi",
  agree: "vi",
  answer: "vt",
  ask: "vt",
  avoid: "vt",
  awake: "vt",
  be: ["vlink", "aux"],
  beat: "vt",
  become: "vlink",
  begin: "vt",
  believe: "vt",
  blow: "vi",
  book: "vt",
  borrow: "vt",
  break: "vt",
  brush: "vt",
  build: "vt",
  burn: "vt",
  call: "vt",
  can: "modal",
  cancel: "vt",
  care: "vi",
  catch: "vt",
  celebrate: "vt",
  change: "vt",
  cheat: "vi",
  climb: "vt",
  clone: "vt",
  communicate: "vi",
  copy: "vt",
  correct: "vt",
  cost: "vt",
  could: "modal",
  cover: "vt",
  cry: "vi",
  cut: "vt",
  dare: ["vt", "modal"],
  deal: "vi",
  decide: "vt",
  develop: "vt",
  die: "vi",
  dig: "vt",
  draw: "vt",
  dress: "vt",
  drink: "vt",
  drive: "vt",
  drop: "vt",
  dry: "vt",
  eat: "vt",
  email: "vt",
  "e-mail": "vt",
  end: "vi",
  fail: "vi",
  feel: ["vlink", "vt"],
  fight: "vi",
  finish: "vt",
  fit: "vt",
  forget: "vt",
  get: ["vlink", "vt"],
  grow: ["vi", "vt", "vlink"],
  hang: "vt",
  hear: "vt",
  hide: "vt",
  hope: "vi",
  increase: "vi",
  influence: "vt",
  join: "vt",
  jump: "vi",
  keep: ["vt", "vlink"],
  kick: "vt",
  kill: "vt",
  knock: "vi",
  know: "vt",
  land: "vi",
  laugh: "vi",
  leave: "vt",
  lie: "vi",
  lift: "vt",
  litter: "vt",
  look: ["vlink", "vi"],
  lose: "vt",
  manage: "vt",
  marry: "vt",
  may: "modal",
  mend: "vt",
  might: "modal",
  move: "vt",
  must: "modal",
  need: ["vt", "modal"],
  own: "vt",
  pay: "vt",
  phone: "vt",
  pick: "vt",
  place: "vt",
  plan: "vt",
  play: "vt",
  please: "vt",
  point: "vi",
  post: "vt",
  practise: "vt",
  practice: "vt",
  pull: "vt",
  push: "vt",
  put: "vt",
  reach: "vt",
  read: "vt",
  receive: "vt",
  recite: "vt",
  regard: "vt",
  relax: "vt",
  remain: ["vlink", "vi"],
  remember: "vt",
  repair: "vt",
  report: "vt",
  return: "vt",
  ride: "vt",
  ring: "vi",
  row: "vi",
  sail: "vi",
  score: "vt",
  search: "vt",
  seem: "vlink",
  sell: "vt",
  send: "vt",
  separate: "vt",
  shall: "modal",
  shake: "vt",
  shape: "vt",
  shine: "vi",
  shout: "vi",
  show: "vt",
  shut: "vt",
  sing: "vi",
  smell: ["vt", "vlink"],
  smoke: "vi",
  snow: "vi",
  sound: ["vlink", "vi"],
  speak: "vi",
  speed: "vi",
  spell: "vt",
  spend: "vt",
  spread: "vi",
  stand: "vi",
  start: "vt",
  stay: ["vi", "vlink"],
  stop: "vi",
  study: "vt",
  sweep: "vt",
  talk: "vi",
  taste: ["vt", "vlink"],
  teach: "vt",
  telephone: "vt",
  should: "modal",
  think: "vi",
  throw: "vt",
  train: "vt",
  try: "vt",
  understand: "vt",
  wake: "vt",
  walk: "vi",
  want: "vt",
  wash: "vt",
  wear: "vt",
  will: "modal",
  win: "vt",
  wonder: "vi",
  work: "vi",
  worry: "vi",
  would: "modal",
  write: "vt"
};

export function normalizeWord(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePartOfSpeechToken(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[。．]/g, ".")
    .replace(/[()（）]/g, "")
    .replace(/\.+$/g, "")
    .replace(/[^a-z\u4e00-\u9fa5]/g, "");
}

function genericVerbKey(word = "") {
  return speechTextForWord(word).toLowerCase().replace(/\s+/g, " ").trim();
}

function addPartOfSpeechKey(keys: PartOfSpeechKey[], key: PartOfSpeechKey) {
  if (!keys.includes(key)) keys.push(key);
}

function addPartOfSpeechKeys(keys: PartOfSpeechKey[], keyOrKeys: PartOfSpeechKey | PartOfSpeechKey[]) {
  (Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]).forEach((key) => addPartOfSpeechKey(keys, key));
}

function hasAuxVAbbreviation(value = "") {
  return value
    .split(/\s+/)
    .map((token) => normalizePartOfSpeechToken(token))
    .some((token) => token === "auxv");
}

export function partOfSpeechKeys(value = "", options: { word?: string; classifyGenericVerb?: boolean } = {}) {
  const classifyGenericVerb = options.classifyGenericVerb ?? true;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[。．]/g, ".")
    .replace(/aux_v\s*情态动词/g, " modal ")
    .replace(/aux_v\s*助动词/g, " aux ")
    .replace(/auxv\s*情态动词/g, " modal ")
    .replace(/auxv\s*助动词/g, " aux ")
    .replace(/aux\s*\.?\s*v\.?/g, " auxv ")
    .replace(/aux_v/g, " auxv ")
    .replace(/modal\s*\.?\s*v\.?/g, " modalv ")
    .replace(/model\s*\.?\s*v\.?/g, " modalv ")
    .replace(/link\s*\.?\s*v\.?/g, " linkv ")
    .replace(/系动词|连系动词/g, " vlink ")
    .replace(/情态动词/g, " modal ")
    .replace(/助动词/g, " aux ")
    .replace(/不及物动词/g, " vi ")
    .replace(/及物动词/g, " vt ")
    .replace(/[、，,；;／/|&+]/g, " ")
    .replace(/\band\b/g, " ");

  const keys: PartOfSpeechKey[] = [];
  normalized.split(/\s+/).forEach((token) => {
    const normalizedToken = normalizePartOfSpeechToken(token);
    if (genericVerbAliases.has(normalizedToken)) {
      if (!classifyGenericVerb) return;
      addPartOfSpeechKeys(keys, genericVerbTransitivity[genericVerbKey(options.word)] ?? "vt");
      return;
    }

    const key = posAliasToKey[normalizedToken];
    if (key) addPartOfSpeechKey(keys, key);
  });

  return keys;
}

export function formatPartOfSpeech(value = "", word = "") {
  const keys = partOfSpeechKeys(value, { word });
  if (!keys.length) return value.trim();

  return keys
    .map((key) => partOfSpeechDefinitions.find((definition) => definition.key === key))
    .filter((definition): definition is (typeof partOfSpeechDefinitions)[number] => Boolean(definition))
    .map((definition) => `${definition.abbr} ${definition.label}`)
    .join(" / ");
}

export function splitPartOfSpeechEntries(value = "") {
  const formatted = formatPartOfSpeech(value);
  return formatted
    .split(/\s+\/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitMeaningEntries(value = "", lineCount: number) {
  const normalized = value
    .split(/[；;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (lineCount <= 1) return [value.trim()];
  if (!normalized.length) return Array.from({ length: lineCount }, () => "");

  const groupSize = Math.ceil(normalized.length / lineCount);
  return Array.from({ length: lineCount }, (_, index) => normalized.slice(index * groupSize, (index + 1) * groupSize).join("；"));
}

export function answerLinesFor(word: Pick<WordEntry, "partOfSpeech" | "meaning">) {
  const partOfSpeechEntries = splitPartOfSpeechEntries(word.partOfSpeech);
  const entries = partOfSpeechEntries.length ? partOfSpeechEntries : [word.partOfSpeech.trim()].filter(Boolean);
  const meaningEntries = splitMeaningEntries(word.meaning, Math.max(entries.length, 1));

  return (entries.length ? entries : [""]).map((partOfSpeech, index) => ({
    partOfSpeech,
    meaning: meaningEntries[index] ?? ""
  }));
}

export function isPartOfSpeechCorrect(expectedValue = "", receivedValue = "") {
  const expected = partOfSpeechKeys(expectedValue);
  const received = partOfSpeechKeys(receivedValue, { classifyGenericVerb: false });

  if (expected.length && received.length) {
    if ((expected.includes("aux") || expected.includes("modal")) && hasAuxVAbbreviation(receivedValue)) {
      return true;
    }
    return received.some((key) => expected.includes(key));
  }

  return Boolean(receivedValue.trim()) && normalizePartOfSpeechToken(expectedValue) === normalizePartOfSpeechToken(receivedValue);
}

export function normalizePartOfSpeech(value = "") {
  return formatPartOfSpeech(value);
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

function linesFromAnswer(input: AnswerInput) {
  if (input.lines?.length) return input.lines;
  return [
    {
      partOfSpeech: input.partOfSpeech ?? "",
      meaning: input.meaning ?? ""
    }
  ];
}

function formatLinesForVerdict(lines: { partOfSpeech?: string; meaning?: string }[], field: "partOfSpeech" | "meaning") {
  return lines
    .map((line, index) => `${index + 1}. ${line[field] ?? ""}`.trim())
    .join("\n");
}

function isPartOfSpeechLinesCorrect(question: Question, input: AnswerInput) {
  const expectedLines = question.answer.lines?.length
    ? question.answer.lines
    : answerLinesFor({ partOfSpeech: question.answer.partOfSpeech, meaning: question.answer.meaning });
  const receivedLines = linesFromAnswer(input);

  return expectedLines.every((line, index) => isPartOfSpeechCorrect(line.partOfSpeech, receivedLines[index]?.partOfSpeech));
}

export function gradeAnswer(question: Question, input: AnswerInput): AnswerVerdict {
  const fields: AnswerVerdict["fields"] = {};

  if (question.targetFields.includes("word")) {
    const expected = normalizeWord(question.answer.word);
    const received = normalizeWord(input.word);
    fields.word = fieldVerdict(received === expected ? "correct" : "wrong", question.answer.word, input.word ?? "");
  }

  if (question.targetFields.includes("partOfSpeech")) {
    const expectedLines = question.answer.lines?.length
      ? question.answer.lines
      : answerLinesFor({ partOfSpeech: question.answer.partOfSpeech, meaning: question.answer.meaning });
    const receivedLines = linesFromAnswer(input);
    fields.partOfSpeech = fieldVerdict(
      isPartOfSpeechLinesCorrect(question, input) ? "correct" : "wrong",
      formatLinesForVerdict(expectedLines, "partOfSpeech"),
      formatLinesForVerdict(receivedLines, "partOfSpeech")
    );
  }

  if (question.targetFields.includes("meaning")) {
    const expected = normalizeMeaning(question.answer.meaning);
    const receivedMeaning = input.lines?.length ? input.lines.map((line) => line.meaning).join("；") : input.meaning;
    const received = normalizeMeaning(receivedMeaning);
    let status: FieldStatus = "wrong";
    let note: string | undefined;

    if (received && (expected === received || expected.includes(received) || received.includes(expected))) {
      status = "correct";
    } else if (received) {
      status = "pending";
      note = "中文释义可能存在同义表达，需要家长确认";
    }

    fields.meaning = fieldVerdict(status, question.answer.meaning, receivedMeaning ?? "", note);
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
  const entryType: "word" | "phrase" = word.entryType === "phrase" ? "phrase" : "word";
  const lines = answerLinesFor(word);
  const answer = {
    entryType,
    word: word.word,
    partOfSpeech: word.partOfSpeech,
    meaning: word.meaning,
    lines
  };

  if (entryType === "phrase") {
    if (promptType === "audio") {
      return {
        id,
        wordId: word.id,
        entryType,
        promptType,
        prompt: "听英文词组，填写英文词组和中文意思",
        speechText: speechTextForWord(word.word),
        targetFields: ["word", "meaning"],
        answer
      };
    }

    if (promptType === "english") {
      return {
        id,
        wordId: word.id,
        entryType,
        promptType,
        prompt: word.word,
        targetFields: ["meaning"],
        answer
      };
    }

    return {
      id,
      wordId: word.id,
      entryType,
      promptType,
      prompt: word.meaning,
      targetFields: ["word"],
      answer
    };
  }

  if (promptType === "audio") {
    return {
      id,
      wordId: word.id,
      entryType,
      promptType,
      prompt: "听英文发音，填写词性、英文和中文意思",
      speechText: speechTextForWord(word.word),
      targetFields: ["partOfSpeech", "word", "meaning"],
      answer
    };
  }

  if (promptType === "english") {
    return {
      id,
      wordId: word.id,
      entryType,
      promptType,
      prompt: word.word,
      targetFields: ["partOfSpeech", "meaning"],
      answer
    };
  }

  return {
    id,
    wordId: word.id,
    entryType,
    promptType,
    prompt: word.meaning,
    targetFields: ["partOfSpeech", "word"],
    answer
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
    "(n\\.?|noun|v\\.?|verb|vt\\.?|vi\\.?|vlink|link\\.?v\\.?|linking\\s*verb|aux_v|aux\\.?\\s*v\\.?|modal\\.?\\s*v\\.?|model\\.?\\s*v\\.?|adj\\.?|a\\.?|ad\\.?|adv\\.?|adjective|adverb|prep\\.?|preposition|pron\\.?|pronoun|conj\\.?|conjunction|num\\.?|interj\\.?|int\\.?|art\\.?|名词|动词|及物动词|不及物动词|系动词|连系动词|助动词|情态动词|形容词|副词|介词|代词|连词|数词|感叹词|冠词)";

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
  const entryType = input.entryType === "phrase" ? "phrase" : "word";
  return {
    id: crypto.randomUUID(),
    entryType,
    word: input.word.trim(),
    phonetic: input.phonetic?.trim() ?? "",
    partOfSpeech: entryType === "phrase" ? formatPartOfSpeech(input.partOfSpeech || "phrase", input.word) : formatPartOfSpeech(input.partOfSpeech, input.word),
    meaning: input.meaning.trim(),
    unit: input.unit?.trim() ?? "",
    tags: input.tags ?? [],
    notes: input.notes?.trim() ?? "",
    stages: input.stages ?? [],
    source: "custom",
    uploadBatchId: "",
    uploadBatchName: "",
    stats: defaultStats(),
    createdAt: new Date().toISOString()
  };
}
