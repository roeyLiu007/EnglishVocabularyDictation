"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Languages, PenLine, Volume2 } from "lucide-react";
import { speechTextForWord } from "@/lib/dictation";
import type { AnswerInput, AnswerLine, DictationRoom, SubmittedAnswer } from "@/lib/types";

type RoomPayload = {
  room: DictationRoom;
  answers: SubmittedAnswer[];
};

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "未记录";
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang.startsWith("en-us")) score += 40;
  else if (lang.startsWith("en-gb")) score += 34;
  else if (lang.startsWith("en")) score += 24;

  if (voice.localService) score += 4;
  if (/samantha|daniel|karen|alex|google us english|microsoft (aria|jenny|guy)/.test(name)) score += 18;
  if (/enhanced|premium|natural/.test(name)) score += 10;
  if (/compact|eloquence|novelty/.test(name)) score -= 20;

  return score;
}

export function ChildRoom({ roomId, token }: { roomId: string; token: string }) {
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerInput>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [speechRate, setSpeechRate] = useState(0.78);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  async function load() {
    const response = await fetch(`/api/rooms/${roomId}?token=${token}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "加载失败");
      return;
    }
    setPayload(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const englishVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));

      setVoices(englishVoices);
      setVoiceName((current) => current || localStorage.getItem("dictationVoiceName") || englishVoices[0]?.name || "");
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !voiceName) return;
    localStorage.setItem("dictationVoiceName", voiceName);
  }, [voiceName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedRate = Number(localStorage.getItem("dictationSpeechRate"));
    if (savedRate >= 0.55 && savedRate <= 1) setSpeechRate(savedRate);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dictationSpeechRate", String(speechRate));
  }, [speechRate]);

  const room = payload?.room;
  const answeredIds = useMemo(() => new Set(payload?.answers.map((item) => item.questionId) ?? []), [payload]);
  const current = room?.questions[index];
  const currentEntryType = current?.answer.entryType === "phrase" || current?.entryType === "phrase" ? "phrase" : "word";
  const isDone = Boolean(room && payload && payload.answers.length >= room.questions.length);
  const answerLines = current?.answer.lines?.length
    ? current.answer.lines
    : [{ partOfSpeech: current?.answer.partOfSpeech ?? "", meaning: current?.answer.meaning ?? "" }];
  const inputLines = answer.lines?.length ? answer.lines : answerLines.map(() => ({ partOfSpeech: "", meaning: "" }));

  useEffect(() => {
    if (!room) return;
    const nextIndex = room.questions.findIndex((question) => !answeredIds.has(question.id));
    if (nextIndex >= 0) setIndex(nextIndex);
  }, [room, answeredIds]);

  useEffect(() => {
    if (!current?.id || isDone) return;
    const startedAt = Date.now();
    setQuestionStartedAt(startedAt);
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [current?.id, isDone]);

  function speak() {
    if (typeof window === "undefined" || !current) return;
    const text = speechTextForWord(current.speechText || current.answer.word);
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find((voice) => voice.name === voiceName) ?? voices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = speechRate;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function submit() {
    if (!current) return;
    const durationSeconds = Math.max(elapsedSeconds, Math.ceil((Date.now() - questionStartedAt) / 1000));
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, questionId: current.id, answer, durationSeconds })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "提交失败");
      setAnswer({});
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<AnswerLine>) {
    setAnswer((value) => {
      const baseLines = value.lines?.length ? value.lines : answerLines.map(() => ({ partOfSpeech: "", meaning: "" }));
      return {
        ...value,
        lines: baseLines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
      };
    });
  }

  async function finish() {
    await fetch(`/api/rooms/${roomId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    await load();
  }

  if (!room) {
    return <section className="panel">{message || "加载房间中..."}</section>;
  }

  if (isDone) {
    const correctCount = payload.answers.filter((item) => item.verdict.overall === "correct").length;
    return (
      <section className="grid">
        <div className="panel">
          <h1>听写完成</h1>
          <p className="prompt" style={{ fontSize: 44 }}>
            {correctCount} / {room.questions.length}
          </p>
          <button onClick={finish} type="button">
            <Check size={18} /> 查看答案
          </button>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>本次答案</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>题目</th>
                  <th>正确答案</th>
                  <th>用时</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {room.questions.map((question) => {
                  const submitted = payload.answers.find((item) => item.questionId === question.id);
                  return (
                    <tr key={question.id}>
                      <td>{question.promptType === "audio" ? (question.answer.entryType === "phrase" ? "听英文词组" : "听英文") : question.prompt}</td>
                      <td>
                        <div>{question.answer.word}</div>
                        {question.answer.entryType === "phrase" ? (
                          <div>{question.answer.meaning}</div>
                        ) : (
                          (question.answer.lines ?? [{ partOfSpeech: question.answer.partOfSpeech, meaning: question.answer.meaning }]).map((line, lineIndex) => (
                            <div key={`${question.id}-answer-${lineIndex}`}>
                              {line.partOfSpeech} / {line.meaning || question.answer.meaning}
                            </div>
                          ))
                        )}
                      </td>
                      <td>{formatDuration(submitted?.durationSeconds)}</td>
                      <td className={submitted?.verdict.overall === "correct" ? "ok" : submitted?.verdict.overall === "pending" ? "pending" : "wrong"}>
                        {submitted?.verdict.overall === "correct" ? "正确" : submitted?.verdict.overall === "pending" ? "待确认" : "需复习"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  if (!current) return <section className="panel">题目加载中...</section>;

  return (
    <section className="question dictation-layout">
      <div className="dictation-meta">
        <span className="pill">
          {index + 1} / {room.questions.length}
        </span>
        <span className="pill" style={{ marginLeft: 8 }}>
          {current.promptType === "audio"
            ? currentEntryType === "phrase"
              ? "听词组"
              : "听英文"
            : current.promptType === "english"
              ? currentEntryType === "phrase"
                ? "看词组"
                : "看英文"
              : "看中文"}
        </span>
        <span className="pill timer-pill">
          <Clock size={15} /> 本题 {formatDuration(elapsedSeconds)}
        </span>
      </div>

      <div className="panel dictation-prompt-card">
        {current.promptType === "audio" ? (
          <div className="audio-prompt">
            <div className="audio-prompt-main">
              <p className="prompt dictation-prompt-title">{currentEntryType === "phrase" ? "听英文词组" : "听英文发音"}</p>
              <button className="play-button" onClick={speak} type="button">
                <Volume2 size={24} /> 播放
              </button>
            </div>
            <div className="audio-controls">
              <label>
                声音
                <select value={voiceName} onChange={(event) => setVoiceName(event.target.value)}>
                  {voices.length ? (
                    voices.map((voice) => (
                      <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  ) : (
                    <option value="">浏览器默认英文</option>
                  )}
                </select>
              </label>
              <label>
                语速：{speechRate.toFixed(2)}
                <input
                  max={1}
                  min={0.55}
                  step={0.05}
                  type="range"
                  value={speechRate}
                  onChange={(event) => setSpeechRate(Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="prompt text-prompt">{current.prompt}</div>
        )}
      </div>

      <div className="panel answer-card">
        <div className="answer-card-header">
          <div>
            <span className="answer-eyebrow">作答区</span>
            <h2>填写答案</h2>
          </div>
          <span className="answer-count">
            {current.targetFields.includes("word") ? "英文" : ""}
            {current.targetFields.includes("word") && (current.targetFields.includes("partOfSpeech") || current.targetFields.includes("meaning")) ? " + " : ""}
            {current.targetFields.includes("partOfSpeech") ? "词性" : ""}
            {current.targetFields.includes("partOfSpeech") && current.targetFields.includes("meaning") ? " / " : ""}
            {current.targetFields.includes("meaning") ? "中文意思" : ""}
          </span>
        </div>

        <div className="answer-fields">
        {current.targetFields.includes("word") ? (
          <label className="answer-field answer-field-primary">
            <span className="field-label">
              <PenLine size={18} /> {currentEntryType === "phrase" ? "英文词组" : "英文"}
            </span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoFocus
              className="answer-input-primary"
              placeholder={currentEntryType === "phrase" ? "填写英文词组" : "填写英文单词"}
              value={answer.word ?? ""}
              onChange={(event) => setAnswer((value) => ({ ...value, word: event.target.value }))}
            />
          </label>
        ) : null}

        {current.targetFields.includes("partOfSpeech") || current.targetFields.includes("meaning") ? (
          <div className="answer-lines">
            {answerLines.map((_, lineIndex) => (
              <div className="answer-line-card" key={`${current.id}-line-${lineIndex}`}>
                <div className="line-number">第 {lineIndex + 1} 行</div>
                <div className="line-fields">
                  {current.targetFields.includes("partOfSpeech") ? (
                    <label className="answer-field">
                      <span className="field-label">
                        <Languages size={17} /> 词性
                      </span>
                      <input
                        autoComplete="off"
                        placeholder="如 n 或 名词"
                        value={inputLines[lineIndex]?.partOfSpeech ?? ""}
                        onChange={(event) => updateLine(lineIndex, { partOfSpeech: event.target.value })}
                      />
                    </label>
                  ) : null}
                  {current.targetFields.includes("meaning") ? (
                    <label className="answer-field">
                      <span className="field-label">
                        <Languages size={17} /> 中文意思
                      </span>
                      <input
                        autoComplete="off"
                        placeholder="填写中文意思"
                        value={inputLines[lineIndex]?.meaning ?? ""}
                        onChange={(event) => updateLine(lineIndex, { meaning: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

          <button className="submit-answer-button" disabled={loading} onClick={submit} type="button">
            <Check size={20} /> {loading ? "提交中..." : "提交并进入下一题"}
          </button>
          {message ? <p className="muted answer-message">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
