"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Play } from "lucide-react";
import { completeRoomLinks } from "@/lib/room-links";
import type { DictationRoom, WordEntry } from "@/lib/types";
import { stageLabel, vocabularyStages } from "@/lib/vocabulary";

type CreatedRoom = {
  room: DictationRoom;
  parentUrl: string;
  childUrl: string;
};

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text || `请求失败：${response.status}`);
  }
}

export function CreateRoom() {
  const [totalCount, setTotalCount] = useState(20);
  const [mistakeRatio, setMistakeRatio] = useState(30);
  const [promptWeights, setPromptWeights] = useState({ audio: 50, english: 25, chinese: 25 });
  const [dictationPerson, setDictationPerson] = useState("");
  const [wordSource, setWordSource] = useState<"all" | "stage" | "latestUpload">("stage");
  const [stage, setStage] = useState("junior");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [created, setCreated] = useState<CreatedRoom | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/words", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setWords(data.words ?? []))
      .catch(() => setWords([]));
  }, []);

  const latestBatchId =
    words
      .map((word) => word.uploadBatchId)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "";
  const latestBatchName = words.find((word) => word.uploadBatchId === latestBatchId)?.uploadBatchName ?? "最近一次上传";
  const sourceCount = useMemo(() => {
    if (wordSource === "stage") return words.filter((word) => word.stages?.includes(stage)).length;
    if (wordSource === "latestUpload") return words.filter((word) => word.uploadBatchId && word.uploadBatchId === latestBatchId).length;
    return words.length;
  }, [latestBatchId, stage, wordSource, words]);

  async function create() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCount, mistakeRatio, wordSource, stage, promptTypeWeights: promptWeights, dictationPerson })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "创建失败");
      const createdRoom = data as CreatedRoom;
      setCreated({
        ...createdRoom,
        ...completeRoomLinks(createdRoom.room, createdRoom.parentUrl, createdRoom.childUrl, window.location.origin)
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("链接已复制");
  }

  return (
    <div className="grid cols-2">
      <section className="panel">
        <div className="form">
          <label>
            听写人
            <input maxLength={40} placeholder="例如：浩辰" required value={dictationPerson} onChange={(event) => setDictationPerson(event.target.value)} />
          </label>
          <label>
            听写词库
            <select value={wordSource} onChange={(event) => setWordSource(event.target.value as "all" | "stage" | "latestUpload")}>
              <option value="stage">基础词汇表</option>
              <option value="latestUpload">最近一次上传</option>
              <option value="all">全部词库</option>
            </select>
          </label>
          {wordSource === "stage" ? (
            <label>
              基础词汇表
              <select value={stage} onChange={(event) => setStage(event.target.value)}>
                {vocabularyStages.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {wordSource === "latestUpload" ? <p className="muted">当前选择：{latestBatchId ? latestBatchName : "还没有上传批次"}</p> : null}
          <p className="muted">
            当前范围约 {sourceCount} 个词{wordSource === "stage" ? `（${stageLabel(stage)}）` : ""}。
          </p>
          <label>
            本次听写数量
            <input min={1} max={100} type="number" value={totalCount} onChange={(event) => setTotalCount(Number(event.target.value))} />
          </label>
          <label>
            易错词混入比例：{mistakeRatio}%
            <input
              min={0}
              max={80}
              step={5}
              type="range"
              value={mistakeRatio}
              onChange={(event) => setMistakeRatio(Number(event.target.value))}
            />
          </label>
          <fieldset className="question-mix-fieldset">
            <legend>题型比例</legend>
            {([
              ["audio", "听音写词"],
              ["english", "看英文写中文"],
              ["chinese", "看中文写英文"]
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label}：{promptWeights[key]}%</span>
                <input min={0} max={100} step={5} type="range" value={promptWeights[key]}
                  onChange={(event) => setPromptWeights((value) => ({ ...value, [key]: Number(event.target.value) }))} />
              </label>
            ))}
            <p className="muted">系统会按相对比例出题，三项不必相加等于 100。</p>
          </fieldset>
          <p className="muted">孩子全部完成后先查看成绩，再自行打开答案解析。</p>
          <button disabled={loading || !dictationPerson.trim()} onClick={create} type="button">
            <Play size={18} /> {loading ? "创建中..." : "创建听写房间"}
          </button>
          {message ? <p className="muted">{message}</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>房间信息</h2>
        {created ? (
          <div className="form">
            <div>
              <span className="muted">房间码</span>
              <div className="prompt" style={{ fontSize: 48 }}>
                {created.room.id}
              </div>
            </div>
            <label>
              孩子答题链接
              <input readOnly value={created.childUrl} />
            </label>
            <button className="secondary" onClick={() => copy(created.childUrl)} type="button">
              <Copy size={18} /> 复制孩子链接
            </button>
            <label>
              家长监控链接
              <input readOnly value={created.parentUrl} />
            </label>
            <a className="button" href={created.parentUrl}>
              进入家长监控
            </a>
          </div>
        ) : (
          <p className="muted">创建后会在这里生成孩子链接和家长监控链接。</p>
        )}
      </section>
    </div>
  );
}
