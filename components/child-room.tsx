"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Volume2 } from "lucide-react";
import { speechTextForWord } from "@/lib/dictation";
import type { AnswerInput, AnswerLine, DictationRoom, SubmittedAnswer } from "@/lib/types";

type RoomPayload = {
  room: DictationRoom;
  answers: SubmittedAnswer[];
};

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
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, questionId: current.id, answer })
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
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {room.questions.map((question) => {
                  const submitted = payload.answers.find((item) => item.questionId === question.id);
                  return (
                    <tr key={question.id}>
                      <td>{question.promptType === "audio" ? "听英文" : question.prompt}</td>
                      <td>
                        <div>{question.answer.word}</div>
                        {(question.answer.lines ?? [{ partOfSpeech: question.answer.partOfSpeech, meaning: question.answer.meaning }]).map((line, lineIndex) => (
                          <div key={`${question.id}-answer-${lineIndex}`}>
                            {line.partOfSpeech} / {line.meaning || question.answer.meaning}
                          </div>
                        ))}
                      </td>
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
    <section className="question">
      <div>
        <span className="pill">
          {index + 1} / {room.questions.length}
        </span>
        <span className="pill" style={{ marginLeft: 8 }}>
          {current.promptType === "audio" ? "听英文" : current.promptType === "english" ? "看英文" : "看中文"}
        </span>
      </div>

      <div className="panel">
        {current.promptType === "audio" ? (
          <div className="grid">
            <p className="prompt" style={{ fontSize: 40 }}>
              听英文发音
            </p>
            <div className="grid cols-2">
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
            <button onClick={speak} type="button">
              <Volume2 size={22} /> 播放
            </button>
          </div>
        ) : (
          <div className="prompt">{current.prompt}</div>
        )}
      </div>

      <div className="grid">
        {current.targetFields.includes("word") ? (
          <label>
            英文
            <input
              autoCapitalize="none"
              autoComplete="off"
              value={answer.word ?? ""}
              onChange={(event) => setAnswer((value) => ({ ...value, word: event.target.value }))}
            />
          </label>
        ) : null}

        {current.targetFields.includes("partOfSpeech") || current.targetFields.includes("meaning") ? (
          <div className="panel" style={{ padding: 12 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 54 }}>行</th>
                  {current.targetFields.includes("partOfSpeech") ? <th>词性</th> : null}
                  {current.targetFields.includes("meaning") ? <th>中文意思</th> : null}
                </tr>
              </thead>
              <tbody>
                {answerLines.map((line, lineIndex) => (
                  <tr key={`${current.id}-line-${lineIndex}`}>
                    <td>{lineIndex + 1}</td>
                    {current.targetFields.includes("partOfSpeech") ? (
                      <td>
                        <input
                          autoComplete="off"
                          placeholder="如 n 或 名词"
                          value={inputLines[lineIndex]?.partOfSpeech ?? ""}
                          onChange={(event) => updateLine(lineIndex, { partOfSpeech: event.target.value })}
                        />
                      </td>
                    ) : null}
                    {current.targetFields.includes("meaning") ? (
                      <td>
                        <input
                          autoComplete="off"
                          value={inputLines[lineIndex]?.meaning ?? ""}
                          onChange={(event) => updateLine(lineIndex, { meaning: event.target.value })}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <button disabled={loading} onClick={submit} type="button">
        <Check size={18} /> {loading ? "提交中..." : "提交并进入下一题"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
