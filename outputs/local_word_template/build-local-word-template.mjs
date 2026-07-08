import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const outputDir = __dirname;
const localStorePath = path.join(projectRoot, "data/local-store.json");
const outputPath = path.join(outputDir, "本地词库模板.xlsx");
const previewPath = path.join(outputDir, "preview.png");

const headers = ["类型", "英文/词组", "音标", "词性", "中文意思", "阶段词表", "单元", "标签", "备注"];
const stageLabels = {
  junior: "初中",
  senior: "高中",
  cet4: "四级",
  cet6: "六级",
  postgraduate: "考研",
  ielts: "雅思",
};

function joinList(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("；") : "";
}

function stageText(stages) {
  return Array.isArray(stages) ? stages.map((stage) => stageLabels[stage] ?? stage).filter(Boolean).join("；") : "";
}

function effectiveStages(word) {
  if (Array.isArray(word.stages) && word.stages.length) return word.stages;

  const text = `${word.unit ?? ""} ${joinList(word.tags)}`;
  if (/中考|初中/.test(text)) return ["junior"];
  if (/高中|高考/.test(text)) return ["senior"];
  if (/六级|cet6/i.test(text)) return ["cet6"];
  if (/四级|cet4/i.test(text)) return ["cet4"];
  if (/考研/.test(text)) return ["postgraduate"];
  if (/雅思|ielts/i.test(text)) return ["ielts"];

  return [];
}

function entryType(word) {
  if (word.entryType === "phrase") return "phrase";
  return "word";
}

const raw = JSON.parse(await fs.readFile(localStorePath, "utf8"));
const words = Array.isArray(raw.words) ? raw.words : [];
if (!words.length) {
  throw new Error("data/local-store.json does not contain any words.");
}

const rows = words.map((word) => [
  entryType(word),
  word.word ?? "",
  word.phonetic ?? "",
  word.partOfSpeech ?? "",
  word.meaning ?? "",
  stageText(effectiveStages(word)),
  word.unit ?? "",
  joinList(word.tags),
  word.notes ?? "",
]);

const juniorRows = rows.filter((row) => String(row[5]).split("；").includes("初中"));
const seniorRows = rows.filter((row) => String(row[5]).split("；").includes("高中"));

function writeWordSheet(targetSheet, targetRows, tableName) {
  targetSheet.showGridLines = false;
  targetSheet.getRangeByIndexes(0, 0, targetRows.length + 1, headers.length).values = [headers, ...targetRows];
  targetSheet.freezePanes.freezeRows(1);

  const targetLastRow = targetRows.length + 1;
  const targetTable = targetSheet.tables.add(`A1:I${targetLastRow}`, true, tableName);
  targetTable.style = "TableStyleMedium2";
  targetTable.showFilterButton = true;

  targetSheet.getRange("A1:I1").format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF" },
  };
  targetSheet.getRange(`A1:I${targetLastRow}`).format.borders = {
    preset: "inside",
    style: "thin",
    color: "#D9E2EC",
  };
  targetSheet.getRange(`A1:I${targetLastRow}`).format.wrapText = true;
  targetSheet.getRange(`A1:I${targetLastRow}`).format.verticalAlignment = "top";
  targetSheet.getRange(`A1:I${targetLastRow}`).format.font = { name: "Arial", size: 10 };
  targetSheet.getRange("A1:I1").format.rowHeightPx = 28;
  targetSheet.getRange(`A2:I${targetLastRow}`).format.rowHeightPx = 34;

  const widths = [58, 190, 110, 170, 260, 90, 160, 130, 160];
  for (let index = 0; index < widths.length; index += 1) {
    targetSheet.getRangeByIndexes(0, index, targetLastRow, 1).format.columnWidthPx = widths[index];
  }
  targetSheet.getRange(`A2:A${targetLastRow}`).format.horizontalAlignment = "center";
  targetSheet.getRange(`F2:F${targetLastRow}`).format.horizontalAlignment = "center";

  targetSheet.dataValidations.add({
    range: `A2:A${targetLastRow}`,
    rule: { type: "list", values: ["word", "phrase"] },
  });
  targetSheet.dataValidations.add({
    range: `F2:F${targetLastRow}`,
    rule: { type: "list", values: ["初中", "高中", "初中；高中", "四级", "六级", "考研", "雅思"] },
  });
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("本地词库模板");
const juniorSheet = workbook.worksheets.add("初中词库");
const seniorSheet = workbook.worksheets.add("高中词库");
const guide = workbook.worksheets.add("填写说明");

writeWordSheet(sheet, rows, "LocalWordTemplate");
writeWordSheet(juniorSheet, juniorRows, "JuniorWordTemplate");
writeWordSheet(seniorSheet, seniorRows, "SeniorWordTemplate");

guide.showGridLines = false;
guide.getRange("A1:B1").values = [["字段", "说明"]];
guide.getRange("A2:B10").values = [
  ["类型", "填写 word 或 phrase；空缺的本地旧数据已按 word 导出。"],
  ["英文/词组", "必填。"],
  ["音标", "选填。"],
  ["词性", "单词必填，词组可按需要填写。"],
  ["中文意思", "必填。"],
  ["阶段词表", "可填：初中、高中、四级、六级、考研、雅思；多个阶段用分号隔开。"],
  ["单元", "选填，可写教材单元或来源名称。"],
  ["标签", "选填，多个标签用分号隔开。"],
  ["备注", "选填。"],
];
guide.getRange("A1:B1").format = {
  fill: "#1F4E79",
  font: { bold: true, color: "#FFFFFF" },
};
guide.getRange("A1:B10").format.borders = {
  preset: "all",
  style: "thin",
  color: "#D9E2EC",
};
guide.getRange("A1:B10").format.wrapText = true;
guide.getRange("A1:A10").format.columnWidthPx = 100;
guide.getRange("B1:B10").format.columnWidthPx = 430;
guide.getRange("A1:B1").format.rowHeightPx = 28;
guide.getRange("A2:B10").format.rowHeightPx = 38;

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  sheetId: "本地词库模板",
  range: "A1:I8",
  maxChars: 6000,
  tableMaxRows: 8,
  tableMaxCols: 9,
  tableMaxCellChars: 80,
});
console.log(inspect);

const preview = await workbook.render({
  sheetName: "填写说明",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewPath, wordCount: rows.length }, null, 2));
