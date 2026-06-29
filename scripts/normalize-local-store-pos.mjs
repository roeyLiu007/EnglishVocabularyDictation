import fs from "node:fs/promises";

const storePath = process.argv[2] ?? "data/local-store.json";

const definitions = [
  { key: "art", abbr: "art", label: "冠词", aliases: ["art", "article", "冠词"] },
  { key: "vt", abbr: "vt", label: "及物动词", aliases: ["vt", "transitiveverb", "及物动词"] },
  { key: "vi", abbr: "vi", label: "不及物动词", aliases: ["vi", "intransitiveverb", "不及物动词"] },
  { key: "v", abbr: "v", label: "动词", aliases: ["v", "verb", "动词"] },
  { key: "n", abbr: "n", label: "名词", aliases: ["n", "noun", "名词"] },
  { key: "adj", abbr: "adj", label: "形容词", aliases: ["a", "adj", "adjective", "形容词"] },
  { key: "adv", abbr: "adv", label: "副词", aliases: ["ad", "adv", "adverb", "副词"] },
  { key: "prep", abbr: "prep", label: "介词", aliases: ["prep", "preposition", "介词"] },
  { key: "pron", abbr: "pron", label: "代词", aliases: ["pron", "pronoun", "代词"] },
  { key: "conj", abbr: "conj", label: "连词", aliases: ["conj", "conjunction", "连词"] },
  { key: "num", abbr: "num", label: "数词", aliases: ["num", "number", "numeral", "数词"] },
  { key: "interj", abbr: "interj", label: "感叹词", aliases: ["int", "interj", "interjection", "感叹词"] },
  { key: "aux", abbr: "aux", label: "助动词", aliases: ["aux", "auxv", "auxiliaryverb", "助动词"] },
  { key: "modal", abbr: "modal v", label: "情态动词", aliases: ["modal", "modalv", "modalverb", "情态动词"] },
  { key: "abbr", abbr: "abbr", label: "缩写", aliases: ["abbr", "abbreviation", "缩写"] }
];

const aliasToKey = definitions.reduce((aliases, definition) => {
  definition.aliases.forEach((alias) => {
    aliases[alias] = definition.key;
  });
  return aliases;
}, {});

function normalizeToken(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[。．]/g, ".")
    .replace(/[()（）]/g, "")
    .replace(/\.+$/g, "")
    .replace(/[^a-z\u4e00-\u9fa5]/g, "");
}

function keysFor(value = "") {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[。．]/g, ".")
    .replace(/aux\s*\.?\s*v\.?/g, " auxv ")
    .replace(/modal\s*\.?\s*v\.?/g, " modalv ")
    .replace(/不及物动词/g, " vi ")
    .replace(/及物动词/g, " vt ")
    .replace(/[、，,；;／/|&+]/g, " ")
    .replace(/\band\b/g, " ");

  const keys = [];
  normalized.split(/\s+/).forEach((token) => {
    const key = aliasToKey[normalizeToken(token)];
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

function format(value = "") {
  const keys = keysFor(value);
  if (!keys.length) return value.trim();
  return keys
    .map((key) => definitions.find((definition) => definition.key === key))
    .filter(Boolean)
    .map((definition) => `${definition.abbr} ${definition.label}`)
    .join(" / ");
}

const store = JSON.parse(await fs.readFile(storePath, "utf8"));
let changedCount = 0;
store.words = (store.words ?? []).map((word) => {
  const next = format(word.partOfSpeech);
  if (next !== word.partOfSpeech) changedCount += 1;
  return { ...word, partOfSpeech: next };
});

let questionChangedCount = 0;
store.rooms = (store.rooms ?? []).map((room) => ({
  ...room,
  questions: (room.questions ?? []).map((question) => {
    const next = format(question.answer?.partOfSpeech ?? "");
    if (next !== question.answer?.partOfSpeech) questionChangedCount += 1;
    return {
      ...question,
      answer: {
        ...question.answer,
        partOfSpeech: next
      }
    };
  })
}));

await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ words: store.words.length, changedCount, questionChangedCount }, null, 2));
