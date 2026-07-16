"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, CheckCircle2, Copy, RefreshCcw, SquareCheckBig, XCircle } from "lucide-react";
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

  async function markVerdict(answer: SubmittedAnswer, correct: boolean) {
    if (!room) return;
    const question = room.questions.find((item) => item.id === answer.questionId);
    if (!question) return;
    const fields = Object.fromEntries(
      question.targetFields.map((field) => {
        const currentField = answer.verdict.fields[field];
        const status = correct ? "correct" : currentField?.status === "correct" ? "correct" : "wrong";
        return [field, {
          status,
          expected: question.answer[field === "partOfSpeech" ? "partOfSpeech" : field],
          received: answer.answer[field] ?? "",
          note: correct ? "教师改判为正确" : "教师确认此项错误"
        }];
      })
    ) as AnswerVerdict["fields"];
    const verdictOverride: AnswerVerdict = {
      overall: correct ? "correct" : "wrong",
      fields
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

  async function recordMistakes() {
    const response = await fetch(`/api/rooms/${roomId}/record-mistakes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await readApiJson<ActionPayload>(response, "记录错题失败");
    if (!response.ok) { setMessage(data.error ?? "记录错题失败"); return; }
    setMessage("本次结果已记录到错题本");
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
  const statusLabel = room.status === "recorded" ? "已记录错题" : room.status === "completed" ? "学生已交卷" : room.status === "closed" ? "已提前结束" : "进行中";

  return (
    <div className="grid">
      <section className="grid cols-3">
        <div className="panel stat">
          <strong>{room.id}</strong>
          <span>房间码 · {room.dictationPerson || "未标注"} · {statusLabel}</span>
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
                <SquareCheckBig size={18} /> 提前结束听写
              </button>
            ) : null}
            {(room.status === "completed" || room.status === "closed") && room.questions.some((question) => question.manualMistakeRecording) ? (
              <button onClick={recordMistakes} type="button">
                <BookMarked size={18} /> 记录到错题本
              </button>
            ) : null}
            {room.status === "recorded" ? <span className="pill ok">已记录到错题本</span> : null}
          </div>
          {room.status === "closed" ? <p className="muted">提前结束结算：只记录已提交答案中的错误，未提交题目不计错。</p> : null}
          {room.status === "completed" ? <p className="muted">学生交卷结算：错误题和未提交题都会记录到错题本。</p> : null}
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
                      {answer && answer.verdict.overall === "pending" ? (
                        <div className="row-actions">
                          <button className="secondary" onClick={() => markVerdict(answer, true)} type="button">
                            <CheckCircle2 size={18} /> 正确
                          </button>
                          <button className="danger" onClick={() => markVerdict(answer, false)} type="button">
                            <XCircle size={18} /> 错误
                          </button>
                        </div>
                      ) : answer && answer.verdict.overall === "wrong" ? (
                        <button className="secondary" onClick={() => markVerdict(answer, true)} type="button">
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
