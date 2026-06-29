import * as XLSX from "xlsx";
import type { ImportPreviewWord } from "./types";
import { normalizeStage, stageLabel, vocabularyStages } from "./vocabulary";

export const wordTemplateHeaders = ["类型", "英文/词组", "音标", "词性", "中文意思", "阶段词表", "单元", "标签", "备注"] as const;

const requiredHeaders = ["类型", "英文/词组", "中文意思"] as const;

function cellText(value: unknown) {
  return String(value ?? "").trim();
}

function splitList(value = "") {
  return value
    .split(/[、，,；;\/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStages(value = "") {
  return splitList(value)
    .map(normalizeStage)
    .filter(Boolean);
}

function normalizeEntryType(value = ""): "word" | "phrase" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "phrase" || normalized === "词组" || normalized === "短语") return "phrase";
  return "word";
}

export function parseWordTemplate(buffer: Buffer, fileName: string): ImportPreviewWord[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("模板里没有工作表");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });

  if (!rows.length) throw new Error("模板里没有单词");

  const headers = new Set(Object.keys(rows[0] ?? {}).map((header) => header.trim()));
  const missing = requiredHeaders.filter((header) => !headers.has(header));
  if (missing.length) {
    throw new Error(`请使用固定模板上传，缺少列：${missing.join("、")}`);
  }

  const words = rows
    .map((row) => ({
      entryType: normalizeEntryType(cellText(row["类型"])),
      word: cellText(row["英文/词组"]),
      phonetic: cellText(row["音标"]),
      partOfSpeech: cellText(row["词性"]),
      meaning: cellText(row["中文意思"]),
      stages: normalizeStages(cellText(row["阶段词表"])),
      unit: cellText(row["单元"]),
      tags: splitList(cellText(row["标签"])),
      notes: cellText(row["备注"])
    }))
    .filter((word) => word.word || word.partOfSpeech || word.meaning);

  const invalidRow = words.findIndex((word) => !word.word || !word.meaning || (word.entryType !== "phrase" && !word.partOfSpeech));
  if (invalidRow >= 0) {
    throw new Error(`第 ${invalidRow + 2} 行缺少类型、英文/词组、词性或中文意思；词组可不填词性`);
  }

  if (!words.length) throw new Error(`${fileName} 里没有可导入的单词`);
  return words;
}

export function buildWordTemplateWorkbook() {
  const examples = [
    {
      类型: "word",
      "英文/词组": "feel",
      音标: "/fi:l/",
      词性: "vlink 系动词 / vt 及物动词",
      中文意思: "感觉，觉得；摸，触",
      阶段词表: "初中",
      单元: "中考英语大纲1600词",
      标签: "高频；易错",
      备注: "音标选填"
    },
    {
      类型: "phrase",
      "英文/词组": "look after",
      音标: "",
      词性: "phrase 短语",
      中文意思: "照顾，照料",
      阶段词表: "初中",
      单元: "Unit 3",
      标签: "高频",
      备注: "词组不强制填写词性"
    }
  ];
  const sheet = XLSX.utils.json_to_sheet(examples, { header: [...wordTemplateHeaders] });
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 36 },
    { wch: 18 },
    { wch: 24 },
    { wch: 20 },
    { wch: 24 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "单词模板");

  const stageSheet = XLSX.utils.aoa_to_sheet([
    ["阶段词表可选值", "填写说明"],
    ...vocabularyStages.map((stage) => [stage.label, `${stage.key}，也可填写“${stageLabel(stage.key)}”`])
  ]);
  stageSheet["!cols"] = [{ wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, stageSheet, "填写说明");

  return workbook;
}

export function writeWorkbookBuffer(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
