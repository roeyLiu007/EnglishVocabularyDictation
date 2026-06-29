import fs from "node:fs/promises";

const textPath = process.argv[2] ?? "/private/tmp/zhongkao_1600_words.txt";
const baseUrl = process.argv[3] ?? "http://localhost:3000";

const isDryRun = process.argv.includes("--dry-run");
const posAtom =
  "(?:art\\.?|n\\.?|v\\.?|vt\\.?|vi\\.?|a\\.?|adj\\.?|ad\\.?|adv\\.?|prep\\.?|pron\\.?|conj\\.?|num\\.?|int\\.?|interj\\.?|aux\\.?v?\\.?|modal\\.?v?\\.?|abbr\\.?)";
const posRegex = new RegExp(`^${posAtom}(?:\\s*(?:&|/|,|and)\\s*${posAtom})*$`, "i");

function cleanLine(line) {
  return line.replace(/\u00a0/g, " ").replace(/\u3000/g, " ").replace(/．/g, ".").trim();
}

function isPosLine(line) {
  const normalized = cleanLine(line).replace(/\s+/g, " ");
  return Boolean(normalized && normalized.length <= 40 && !/[\u4e00-\u9fa5]/.test(normalized) && posRegex.test(normalized));
}

function startsPhonetic(line) {
  return /^\/\[[^\]]+\]\//.test(cleanLine(line));
}

function hasPhonetic(line) {
  return /\/\[[^\]]+\]\//.test(cleanLine(line));
}

function rawWordFromLine(line) {
  return cleanLine(line)
    .replace(/^\d+[.)、\s-]*/, "")
    .replace(/\s*\/\[[^\]]+\]\/.*$/, "")
    .trim();
}

function isHeader(line) {
  return /^(2025年中考词汇表对照表|考试大纲词汇表|词性|词意|第\s*天|日期[:：]?|PAGE\s+\d+)$/.test(
    cleanLine(line)
  );
}

function isEntryStart(lines, index) {
  const line = cleanLine(lines[index]);
  const next = cleanLine(lines[index + 1] ?? "");
  if (!line || isHeader(line) || startsPhonetic(line) || isPosLine(line)) return false;
  const word = rawWordFromLine(line);
  if (!/[A-Za-z]/.test(word) || word.length > 80) return false;
  return hasPhonetic(line) || startsPhonetic(next) || isPosLine(next);
}

function maybeWordHead(line) {
  const cleaned = cleanLine(line);
  if (!cleaned || isHeader(cleaned) || startsPhonetic(cleaned) || isPosLine(cleaned)) return false;
  return /[A-Za-z]/.test(rawWordFromLine(cleaned)) && rawWordFromLine(cleaned).length <= 80;
}

function joinSplitEntryHeads(lines) {
  const joined = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? "";
    const afterNext = lines[index + 2] ?? "";

    if (maybeWordHead(line) && !hasPhonetic(line) && maybeWordHead(next) && hasPhonetic(next)) {
      joined.push(`${line} ${next}`);
      index += 1;
      continue;
    }

    if (maybeWordHead(line) && !hasPhonetic(line) && maybeWordHead(next) && !hasPhonetic(next) && isPosLine(afterNext)) {
      joined.push(`${line} ${next}`);
      index += 1;
      continue;
    }

    joined.push(line);
  }

  return joined;
}

function parse(text) {
  const lines = joinSplitEntryHeads(text.split(/\r?\n/).map(cleanLine).filter(Boolean));
  const words = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!isEntryStart(lines, index)) continue;

    const word = rawWordFromLine(lines[index]);
    if (!hasPhonetic(lines[index]) && startsPhonetic(lines[index + 1] ?? "")) {
      index += 1;
    }

    const block = [];
    while (index + 1 < lines.length && !isEntryStart(lines, index + 1)) {
      index += 1;
      const line = cleanLine(lines[index]);
      if (!line || isHeader(line) || startsPhonetic(line)) continue;
      block.push(line);
    }

    const partOfSpeechLines = [];
    while (block.length && isPosLine(block[0])) {
      partOfSpeechLines.push(block.shift());
    }

    const meaning = block.join("；").replace(/\s*；\s*/g, "；").trim();
    if (word && meaning) {
      words.push({
        word,
        partOfSpeech: partOfSpeechLines.join(" / "),
        meaning,
        unit: "中考英语大纲1600词"
      });
    }
  }

  return words;
}

const text = await fs.readFile(textPath, "utf8");
const parsed = parse(text);

if (isDryRun) {
  console.log(
    JSON.stringify(
      {
        parsedCount: parsed.length,
        samples: parsed.slice(0, 8),
        suspicious: parsed.filter((word) => /\/\[|；[A-Za-z][A-Za-z(（=]/.test(word.meaning)).slice(0, 20)
      },
      null,
      2
    )
  );
  process.exit(0);
}

const existingResponse = await fetch(`${baseUrl}/api/words`);
if (!existingResponse.ok) {
  throw new Error(`读取当前词库失败：${existingResponse.status}`);
}
const existingData = await existingResponse.json();
const existingKeys = new Set(
  (existingData.words ?? []).map((word) => `${word.word}\u0000${word.partOfSpeech}\u0000${word.meaning}`)
);
const words = parsed.filter((word) => !existingKeys.has(`${word.word}\u0000${word.partOfSpeech}\u0000${word.meaning}`));

const response = await fetch(`${baseUrl}/api/words`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ words })
});

const result = await response.json();
if (!response.ok) {
  throw new Error(result.error ?? `导入失败：${response.status}`);
}

console.log(
  JSON.stringify(
    {
      parsedCount: parsed.length,
      importedCount: result.words?.length ?? 0,
      skippedDuplicateCount: parsed.length - words.length,
      samples: parsed.slice(0, 8)
    },
    null,
    2
  )
);
