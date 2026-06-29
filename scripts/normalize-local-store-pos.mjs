import fs from "node:fs/promises";

const storePath = process.argv[2] ?? "data/local-store.json";

const definitions = [
  { key: "art", abbr: "art", label: "冠词", aliases: ["art", "article", "冠词"] },
  { key: "vt", abbr: "vt", label: "及物动词", aliases: ["vt", "transitiveverb", "及物动词"] },
  { key: "vi", abbr: "vi", label: "不及物动词", aliases: ["vi", "intransitiveverb", "不及物动词"] },
  { key: "n", abbr: "n", label: "名词", aliases: ["n", "noun", "名词"] },
  { key: "adj", abbr: "adj", label: "形容词", aliases: ["a", "adj", "adjective", "形容词"] },
  { key: "adv", abbr: "adv", label: "副词", aliases: ["ad", "adv", "adverb", "副词"] },
  { key: "prep", abbr: "prep", label: "介词", aliases: ["prep", "preposition", "介词"] },
  { key: "pron", abbr: "pron", label: "代词", aliases: ["pron", "pronoun", "代词"] },
  { key: "conj", abbr: "conj", label: "连词", aliases: ["conj", "conjunction", "连词"] },
  { key: "num", abbr: "num", label: "数词", aliases: ["num", "number", "numeral", "数词"] },
  { key: "interj", abbr: "interj", label: "感叹词", aliases: ["int", "interj", "interjection", "感叹词"] },
  { key: "aux", abbr: "aux", label: "助动词", aliases: ["aux", "auxv", "auxiliaryverb", "助动词"] },
  { key: "modal", abbr: "modal", label: "情态动词", aliases: ["modal", "modalv", "modalverb", "情态动词"] },
  { key: "abbr", abbr: "abbr", label: "缩写", aliases: ["abbr", "abbreviation", "缩写"] }
];

const aliasToKey = definitions.reduce((aliases, definition) => {
  definition.aliases.forEach((alias) => {
    aliases[alias] = definition.key;
  });
  return aliases;
}, {});

const genericVerbAliases = new Set(["v", "verb", "动词"]);

const genericVerbTransitivity = {
  act: "vi",
  agree: "vi",
  answer: "vt",
  ask: "vt",
  avoid: "vt",
  awake: "vt",
  be: "vi",
  beat: "vt",
  become: "vi",
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
  cover: "vt",
  cry: "vi",
  cut: "vt",
  dare: "vt",
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
  fight: "vi",
  finish: "vt",
  fit: "vt",
  forget: "vt",
  grow: "vi",
  hang: "vt",
  hear: "vt",
  hide: "vt",
  hope: "vi",
  increase: "vi",
  influence: "vt",
  join: "vt",
  jump: "vi",
  keep: "vt",
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
  look: "vi",
  lose: "vt",
  manage: "vt",
  marry: "vt",
  mend: "vt",
  move: "vt",
  need: "vt",
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
  seem: "vi",
  sell: "vt",
  send: "vt",
  separate: "vt",
  shake: "vt",
  shape: "vt",
  shine: "vi",
  shout: "vi",
  show: "vt",
  shut: "vt",
  sing: "vi",
  smell: "vt",
  smoke: "vi",
  snow: "vi",
  speak: "vi",
  speed: "vi",
  spell: "vt",
  spend: "vt",
  spread: "vi",
  stand: "vi",
  start: "vt",
  stop: "vi",
  study: "vt",
  sweep: "vt",
  talk: "vi",
  teach: "vt",
  telephone: "vt",
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
  win: "vt",
  wonder: "vi",
  work: "vi",
  worry: "vi",
  write: "vt"
};

function normalizeToken(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[。．]/g, ".")
    .replace(/[()（）]/g, "")
    .replace(/\.+$/g, "")
    .replace(/[^a-z\u4e00-\u9fa5]/g, "");
}

function speechTextForWord(value = "") {
  return (
    value
      .trim()
      .replace(/[（(].*$/, "")
      .replace(/[=\/].*$/, "")
      .replace(/[^A-Za-z' -]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || value.trim()
  );
}

function genericVerbKey(word = "") {
  return speechTextForWord(word).toLowerCase().replace(/\s+/g, " ").trim();
}

function keysFor(value = "", word = "") {
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
    const normalizedToken = normalizeToken(token);
    if (genericVerbAliases.has(normalizedToken)) {
      const key = genericVerbTransitivity[genericVerbKey(word)] ?? "vt";
      if (!keys.includes(key)) keys.push(key);
      return;
    }

    const key = aliasToKey[normalizedToken];
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

function format(value = "", word = "") {
  const keys = keysFor(value, word);
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
  const next = format(word.partOfSpeech, word.word);
  if (next !== word.partOfSpeech) changedCount += 1;
  return { ...word, partOfSpeech: next };
});

let questionChangedCount = 0;
store.rooms = (store.rooms ?? []).map((room) => ({
  ...room,
  questions: (room.questions ?? []).map((question) => {
    const next = format(question.answer?.partOfSpeech ?? "", question.answer?.word ?? "");
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
