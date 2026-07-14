"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, RefreshCcw, SquareCheckBig } from "lucide-react";
import { readApiJson } from "@/lib/client-api";
import type { AnswerVerdict, DictationRoom, SubmittedAnswer } from "@/lib/types";

type RoomPayload = {
  room: DictationRoom;
  answers: SubmittedAnswer[];
  error?: string;
};

type ActionPayload = {
  error?: string;
};

function renderAnswerLines(lines?: Array<{ partOfSpeech?: string; meaning?: string }>) {
  if (!lines?.length) return null;
  return lines.map((line, index) => (
    <div key={`${index}-${line.partOfSpeech}-${line.meaning}`}>
      {index + 1}. {line.partOfSpeech || "-"} {line.meaning ? ` / ${line.meaning}` : ""}
    </div>
  ));
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "未记录";
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

export function ParentRoom({ roomId, token }: { roomId: string; token: string }) {
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}?token=${token}`, { cache: "no-store" });
      const data = await readApiJson<RoomPayload>(response, "加载房间失败");
      if (!response.ok) {
        setMessage(data.error ?? "加载失败");
        return;
      }
      setPayload(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }, [roomId, token]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  const room = payload?.room;
  const childUrl = useMemo(() => {
    if (!room || typeof window === "undefined") return "";
    return `${window.location.origin}/child/${room.id}?token=${room.childToken}`;
  }, [room]);

  async function copyChildUrl() {
    await navigator.clipboard.writeText(childUrl);
    setMessage("孩子链接已复制");
  }

  async function markCorrect(answer: SubmittedAnswer) {
    if (!room) return;
    const question = room.questions.find((item) => item.id === answer.questionId);
    if (!question) return;
    const verdictOverride: AnswerVerdict = {
      overall: "correct",
      fields: Object.fromEntries(
        question.targetFields.map((field) => [
          field,
          {
            status: "correct",
            expected: question.answer[field === "partOfSpeech" ? "partOfSpeech" : field],
            received: answer.answer[field] ?? "",
            note: "家长改判为正确"
          }
        ])
      )
    };

    const response = await fetch(`/api/rooms/${roomId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, questionId: answer.questionId, answer: answer.answer, verdictOverride, durationSeconds: answer.durationSeconds })
    });
    const data = await readApiJson<ActionPayload>(response, "改判失败");
    if (!response.ok) {
      setMessage(data.error ?? "改判失败");
      return;
    }
    await load();
  }

  async function finish() {
    const response = await fetch(`/api/rooms/${roomId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await readApiJson<ActionPayload>(response, "结束房间失败");
    if (!response.ok) {
      setMessage(data.error ?? "结束房间失败");
      return;
    }
    await load();
  }

  if (!room) {
    return <section className="panel">{message || "加载房间中..."}</section>;
  }

  const answerMap = new Map(payload.answers.map((answer) => [answer.questionId, answer]));
  const correctCount = payload.answers.filter((answer) => answer.verdict.overall === "correct").length;
  const pendingCount = payload.answers.filter((answer) => answer.verdict.overall === "pending").length;
  const statusLabel = room.status === "completed" ? "已完成" : room.status === "closed" ? "已关闭" : "进行中";

  return (
    <div className="grid">
      <section className="grid cols-3">
        <div className="panel stat">
          <strong>{room.id}</strong>
          <span>房间码 · {statusLabel}</span>
        </div>
        <div className="panel stat">
          <strong>
            {payload.answers.length}/{room.questions.length}
          </strong>
          <span>孩子进度</span>
        </div>
        <div className="panel stat">
          <strong>{correctCount}</strong>
          <span>当前正确数，待确认 {pendingCount}</span>
        </div>
      </section>

      <section className="panel">
        <div className="form">
          <label>
            孩子答题链接
            <input readOnly value={childUrl} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button className="secondary" onClick={copyChildUrl} type="button">
              <Copy size={18} /> 复制孩子链接
            </button>
            <button className="secondary" onClick={load} type="button">
              <RefreshCcw size={18} /> 刷新
            </button>
            {room.status === "active" ? (
              <button onClick={finish} type="button">
                <SquareCheckBig size={18} /> 结束并写入错词本
              </button>
            ) : null}
          </div>
          {message ? <p className="muted">{message}</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>答题详情</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>题型</th>
                <th>题目</th>
                <th>孩子答案</th>
                <th>正确答案</th>
                <th>用时</th>
                <th>判分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {room.questions.map((question) => {
                const answer = answerMap.get(question.id);
                return (
                  <tr key={question.id}>
                    <td>{question.promptType === "audio" ? "听英文" : question.promptType === "english" ? "看英文" : "看中文"}</td>
                    <td>{question.promptType === "audio" ? "英文发音" : question.prompt}</td>
                    <td>
                      {answer ? (
                        <>
                          {answer.answer.word ? <div>英文：{answer.answer.word}</div> : null}
                          {answer.answer.lines?.length ? (
                            renderAnswerLines(answer.answer.lines)
                          ) : (
                            <>
                              {answer.answer.partOfSpeech ? <div>词性：{answer.answer.partOfSpeech}</div> : null}
                              {answer.answer.meaning ? <div>中文：{answer.answer.meaning}</div> : null}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="muted">未提交</span>
                      )}
                    </td>
                    <td>
                      <div>英文：{question.answer.word}</div>
                      {renderAnswerLines(question.answer.lines ?? [{ partOfSpeech: question.answer.partOfSpeech, meaning: question.answer.meaning }])}
                    </td>
                    <td>{answer ? formatDuration(answer.durationSeconds) : "-"}</td>
                    <td className={answer?.verdict.overall === "correct" ? "ok" : answer?.verdict.overall === "pending" ? "pending" : "wrong"}>
                      {answer ? (answer.verdict.overall === "correct" ? "正确" : answer.verdict.overall === "pending" ? "待确认" : "错误") : "-"}
                    </td>
                    <td>
                      {answer && answer.verdict.overall !== "correct" ? (
                        <button className="secondary" onClick={() => markCorrect(answer)} type="button">
                          <CheckCircle2 size={18} /> 改为正确
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
