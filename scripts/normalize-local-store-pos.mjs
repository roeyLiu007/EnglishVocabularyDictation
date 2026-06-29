import fs from "node:fs/promises";

const storePath = process.argv[2] ?? "data/local-store.json";

const definitions = [
  { key: "art", abbr: "art", label: "冠词", aliases: ["art", "article", "冠词"] },
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

function addKey(keys, key) {
  if (!keys.includes(key)) keys.push(key);
}

function addKeys(keys, keyOrKeys) {
  (Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]).forEach((key) => addKey(keys, key));
}

function keysFor(value = "", word = "") {
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

  const keys = [];
  normalized.split(/\s+/).forEach((token) => {
    const normalizedToken = normalizeToken(token);
    if (genericVerbAliases.has(normalizedToken)) {
      addKeys(keys, genericVerbTransitivity[genericVerbKey(word)] ?? "vt");
      return;
    }

    const key = aliasToKey[normalizedToken];
    if (key) addKey(keys, key);
  });
  return keys;
}

function format(value = "", word = "") {
  const keys = keysFor(value, word);
  return formatKeys(keys, value);
}

function formatKeys(keys, fallback = "") {
  if (!keys.length) return fallback.trim();
  return keys
    .map((key) => definitions.find((definition) => definition.key === key))
    .filter(Boolean)
    .map((definition) => `${definition.abbr} ${definition.label}`)
    .join(" / ");
}

const wordPartOfSpeechOverrides = {
  be: ["vlink", "aux"],
  become: ["vlink"],
  bridge: ["n"],
  can: ["modal"],
  could: ["modal"],
  dare: ["vt", "modal"],
  feel: ["vlink", "vt"],
  get: ["vlink", "vt"],
  grow: ["vi", "vt", "vlink"],
  hate: ["vt", "n"],
  keep: ["vt", "vlink"],
  look: ["n", "vlink", "vi"],
  may: ["modal"],
  might: ["modal"],
  must: ["modal"],
  need: ["n", "modal", "vt"],
  remain: ["vlink", "vi"],
  seem: ["vlink"],
  shall: ["modal"],
  should: ["modal"],
  smell: ["vt", "vlink", "n"],
  smile: ["n", "vi"],
  sound: ["vlink", "vi", "n"],
  stay: ["n", "vi", "vlink"],
  taste: ["n", "vt", "vlink"],
  will: ["modal"],
  would: ["modal"]
};

const wordMeaningOverrides = {
  could: "可以；能"
};

function keysForWord(word) {
  const key = genericVerbKey(word.word);
  if (key === "may" && /五月/.test(word.meaning ?? "")) {
    return ["n"];
  }

  const overridden = wordPartOfSpeechOverrides[key];
  if (overridden) return overridden;

  const keys = keysFor(word.partOfSpeech, word.word);
  if (!keys.length || /(?:link|modal|model|aux)\s*\.?\s*v/i.test(word.meaning ?? "")) {
    addKeys(keys, keysFor(word.meaning, word.word));
  }
  return keys;
}

function cleanMeaning(value = "") {
  return value
    .replace(/\bmodal\s*\.?\s*v\.?\s*[；;]?/gi, "")
    .replace(/\bmodel\s*\.?\s*v\.?\s*[；;]?/gi, "")
    .replace(/\blink\s*\.?\s*v\.?\s*[；;]?/gi, "")
    .replace(/\baux\s*\.?\s*v\.?\s*[；;]?/gi, "")
    .replace(/\bvt\s*&\s*n\.?\.?\s*[；;]?/gi, "")
    .replace(/\bn\.?\s*&\s*v\.?\.?\s*[；;]?/gi, "")
    .replace(/\bn\.?\s*&\s*n\.?\.?\s*[；;]?/gi, "")
    .replace(/\bn\.?\.?\s*[；;]?/gi, "")
    .replace(/^[；;、，,\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningForWord(word) {
  const overridden = wordMeaningOverrides[genericVerbKey(word.word)];
  return overridden ?? cleanMeaning(word.meaning ?? "");
}

const store = JSON.parse(await fs.readFile(storePath, "utf8"));
let changedCount = 0;
store.words = (store.words ?? []).map((word) => {
  const next = formatKeys(keysForWord(word), word.partOfSpeech);
  const nextMeaning = meaningForWord(word);
  if (next !== word.partOfSpeech || nextMeaning !== word.meaning) changedCount += 1;
  return { ...word, partOfSpeech: next, meaning: nextMeaning };
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
