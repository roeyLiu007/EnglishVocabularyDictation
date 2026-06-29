import type { WordEntry } from "./types";

export const vocabularyStages = [
  { key: "junior", label: "初中" },
  { key: "senior", label: "高中" },
  { key: "cet4", label: "四级" },
  { key: "cet6", label: "六级" },
  { key: "postgraduate", label: "考研" },
  { key: "ielts", label: "雅思" }
] as const;

export type VocabularyStage = (typeof vocabularyStages)[number]["key"];

export const vocabularyStageKeys = vocabularyStages.map((stage) => stage.key) as VocabularyStage[];

export function stageLabel(stage: string) {
  return vocabularyStages.find((item) => item.key === stage)?.label ?? stage;
}

export function normalizeStage(value = ""): VocabularyStage | "" {
  const normalized = value.trim().toLowerCase();
  const compact = normalized.replace(/\s+/g, "");
  const matched = vocabularyStages.find(
    (stage) => stage.key === compact || stage.label === value.trim() || stage.label.toLowerCase() === compact
  );
  return matched?.key ?? "";
}

export function effectiveStages(word: Pick<WordEntry, "stages" | "unit" | "tags">) {
  if (word.stages?.length) return word.stages;

  const text = `${word.unit ?? ""} ${(word.tags ?? []).join(" ")}`;
  if (/中考|初中/.test(text)) return ["junior"];
  if (/高中|高考/.test(text)) return ["senior"];
  if (/六级|cet6/i.test(text)) return ["cet6"];
  if (/四级|cet4/i.test(text)) return ["cet4"];
  if (/考研/.test(text)) return ["postgraduate"];
  if (/雅思|ielts/i.test(text)) return ["ielts"];

  return [];
}

export function effectiveSource(word: Pick<WordEntry, "source" | "unit" | "stages">) {
  if (word.source) return word.source;
  if (effectiveStages(word).length) return "base";
  return "custom";
}
