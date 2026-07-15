"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Languages, PenLine, SkipForward, Volume2 } from "lucide-react";
import { readApiJson } from "@/lib/client-api";
import { CLOUD_SPEECH_VOICES, type CloudSpeechVoiceId } from "@/lib/cloud-speech";
import { speechTextForWord } from "@/lib/dictation";
import type { AnswerInput, AnswerLine, DictationRoom, SubmittedAnswer } from "@/lib/types";

type RoomPayload = {
  room: DictationRoom;
  answers: SubmittedAnswer[];
  error?: string;
};

type AnswerPayload = {
  error?: string;
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
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserVoiceName, setBrowserVoiceName] = useState("");
  const [cloudVoiceId, setCloudVoiceId] = useState<CloudSpeechVoiceId>("female");
  const [speechRate, setSpeechRate] = useState(0.78);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const speechRequestRef = useRef(0);

  async function load() {
    try {
      const response = await fetch(`/api/rooms/${roomId}?token=${token}`, { cache: "no-store" });
      const data = await readApiJson<RoomPayload>(response, "加载房间失败");
      if (!response.ok) {
        setMessage(data.error ?? "加载失败");
        return;
      }
      setPayload(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const englishVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));

      setBrowserVoices(englishVoices);
      setBrowserVoiceName((current) => current || localStorage.getItem("dictationVoiceName") || englishVoices[0]?.name || "");
    };

    const timers = [0, 200, 800, 2000].map((delay) => window.setTimeout(loadVoices, delay));
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !browserVoiceName) return;
    localStorage.setItem("dictationVoiceName", browserVoiceName);
  }, [browserVoiceName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedVoice = CLOUD_SPEECH_VOICES.find((voice) => voice.id === localStorage.getItem("dictationCloudVoice"));
    if (savedVoice) setCloudVoiceId(savedVoice.id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dictationCloudVoice", cloudVoiceId);
  }, [cloudVoiceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedRate = Number(localStorage.getItem("dictationSpeechRate"));
    if (savedRate >= 0.55 && savedRate <= 1) setSpeechRate(savedRate);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dictationSpeechRate", String(speechRate));
  }, [speechRate]);

  useEffect(() => {
    return () => {
      speechRequestRef.current += 1;
      if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
      if (audioRef.current) {
        audioRef.current.onerror = null;
        audioRef.current.pause();
      }
      if (utteranceRef.current) utteranceRef.current.onerror = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      audioRef.current = null;
      utteranceRef.current = null;
    };
  }, []);

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
    let nextIndex = room.questions.findIndex((question) => !answeredIds.has(question.id) && !skippedIds.includes(question.id));
    if (nextIndex < 0) nextIndex = room.questions.findIndex((question) => !answeredIds.has(question.id));
    if (nextIndex >= 0) setIndex(nextIndex);
  }, [room, answeredIds, skippedIds]);

  useEffect(() => {
    if (!current?.id || (isDone && !reviewMode)) return;
    const startedAt = Date.now();
    setQuestionStartedAt(startedAt);
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [current?.id, isDone, reviewMode]);

  useEffect(() => {
    speechRequestRef.current += 1;
    if (speechTimerRef.current !== null) {
      window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }
    if (utteranceRef.current) utteranceRef.current.onerror = null;
    window.speechSynthesis?.cancel();
    audioRef.current = null;
    utteranceRef.current = null;
    setSpeechLoading(false);
    setSpeechMessage("");
  }, [current?.id]);

  function speakWithBrowserFallback(requestId: number) {
    if (requestId !== speechRequestRef.current) return;
    if (typeof window === "undefined" || !current || !("speechSynthesis" in window)) {
      setSpeechLoading(false);
      setSpeechMessage("发音失败，请稍后重试。");
      return;
    }

    const text = speechTextForWord(current.speechText || current.answer.word);
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = browserVoices.find((voice) => voice.name === browserVoiceName) ?? browserVoices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (requestId !== speechRequestRef.current) return;
      setSpeechLoading(false);
      setSpeechMessage("云端发音暂不可用，已切换到浏览器发音。");
    };
    utterance.onend = () => {
      if (utteranceRef.current === utterance) utteranceRef.current = null;
    };
    utterance.onerror = () => {
      if (requestId !== speechRequestRef.current) return;
      if (utteranceRef.current === utterance) utteranceRef.current = null;
      setSpeechLoading(false);
      setSpeechMessage("发音失败，请检查媒体音量或使用 Chrome 打开链接。");
    };

    utteranceRef.current = utterance;
    if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
    window.speechSynthesis.cancel();
    speechTimerRef.current = window.setTimeout(() => {
      speechTimerRef.current = null;
      if (requestId !== speechRequestRef.current) return;
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }, 80);
  }

  function speak() {
    if (typeof window === "undefined" || !current) return;

    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    if (speechTimerRef.current !== null) {
      window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }
    if (utteranceRef.current) utteranceRef.current.onerror = null;
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setSpeechLoading(true);
    setSpeechMessage("");

    const audio = new Audio();
    let fallbackStarted = false;
    const startFallback = () => {
      if (fallbackStarted || requestId !== speechRequestRef.current) return;
      fallbackStarted = true;
      audio.onerror = null;
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
      speakWithBrowserFallback(requestId);
    };

    audioRef.current = audio;
    audio.preload = "auto";
    audio.playbackRate = speechRate;
    audio.preservesPitch = true;
    audio.onplaying = () => {
      if (requestId !== speechRequestRef.current) return;
      setSpeechLoading(false);
      setSpeechMessage("");
    };
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
    };
    audio.onerror = startFallback;
    audio.src = `/api/rooms/${roomId}/speech/${current.id}?token=${encodeURIComponent(token)}&voice=${cloudVoiceId}`;
    void audio.play().catch(startFallback);
  }

  async function submit() {
    if (!current) return;
    const missing = current.targetFields.some((field) => {
      if (field === "word") return !answer.word?.trim();
      return answerLines.some((_, lineIndex) => !inputLines[lineIndex]?.[field]?.trim());
    });
    if (missing) {
      setMessage("请填写完整后再提交；不会的题可以先跳过。");
      return;
    }
    const durationSeconds = Math.max(elapsedSeconds, Math.ceil((Date.now() - questionStartedAt) / 1000));
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, questionId: current.id, answer, durationSeconds })
      });
      const data = await readApiJson<AnswerPayload>(response, "提交失败");
      if (!response.ok) throw new Error(data.error ?? "提交失败");
      setAnswer({});
      setSkippedIds((items) => items.filter((id) => id !== current.id));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  function skipQuestion() {
    if (!current || !room) return;
    setAnswer({});
    setMessage("已暂时跳过，完成其他题后会再回来。");
    setSkippedIds((items) => (items.includes(current.id) ? items : [...items, current.id]));
    const next = room.questions.findIndex((question, questionIndex) =>
      questionIndex !== index && !answeredIds.has(question.id) && !skippedIds.includes(question.id)
    );
    if (next >= 0) setIndex(next);
  }

  function selectQuestion(questionIndex: number) {
    if (!room) return;
    const question = room.questions[questionIndex];
    const submitted = payload.answers.find((item) => item.questionId === question.id);
    setIndex(questionIndex);
    setAnswer(submitted ? {
      ...submitted.answer,
      lines: submitted.answer.lines?.map((line) => ({ ...line }))
    } : {});
    setMessage(submitted ? `正在修改第 ${questionIndex + 1} 题，提交后会覆盖原答案。` : "");
  }

  function handleAnswerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && !event.shiftKey && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void submit();
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
    const response = await fetch(`/api/rooms/${roomId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await readApiJson<AnswerPayload>(response, "结束房间失败");
    if (!response.ok) {
      setMessage(data.error ?? "结束房间失败");
      return;
    }
    await load();
  }

  if (!room) {
    return <section className="panel">{message || "加载房间中..."}</section>;
  }

  if (room.status === "closed" || ((room.status === "completed" || room.status === "recorded") && !isDone)) {
    return (
      <section className="panel">
        <h1>本次听写已结束</h1>
        <p className="muted">
          已提交 {payload.answers.length} / {room.questions.length} 题，当前链接不能继续答题。
        </p>
      </section>
    );
  }

  if (isDone && !reviewMode) {
    const correctCount = payload.answers.filter((item) => item.verdict.overall === "correct").length;
    const totalSeconds = payload.answers.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
    return (
      <section className="grid completion-view">
        <div className="panel completion-summary">
          <span className="eyebrow">本次听写完成</span>
          <h1>听写完成</h1>
          <p className="prompt" style={{ fontSize: 44 }}>
            {correctCount} / {room.questions.length}
          </p>
          <p className="muted">正确率 {Math.round((correctCount / Math.max(1, room.questions.length)) * 100)}% · 总用时 {formatDuration(totalSeconds)}</p>
          {!showAnswers ? <button onClick={async () => { await finish(); setShowAnswers(true); }} type="button">
            <Check size={18} /> 查看答案解析
          </button> : null}
          {room.status !== "recorded" ? <button className="secondary" onClick={() => { setReviewMode(true); selectQuestion(0); }} type="button">
            <PenLine size={18} /> 检查并修改答案
          </button> : null}
        </div>
        {showAnswers ? <div className="panel">
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
        </div> : null}
      </section>
    );
  }

  if (!current) return <section className="panel">题目加载中...</section>;

  return (
    <section className="question dictation-layout immersive-dictation" onKeyDown={handleAnswerKeyDown}>
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
      <progress className="dictation-progress" max={room.questions.length} value={payload.answers.length} />
      <div className="panel question-navigator" aria-label="选择题目">
        <div className="question-navigator-header">
          <strong>选择题目</strong>
          {isDone ? <button className="secondary" onClick={() => setReviewMode(false)} type="button">返回成绩</button> : null}
        </div>
        <div className="question-number-grid">
          {room.questions.map((question, questionIndex) => (
            <button
              aria-label={`第 ${questionIndex + 1} 题${answeredIds.has(question.id) ? "，已作答" : "，未作答"}`}
              className={`${questionIndex === index ? "current" : ""} ${answeredIds.has(question.id) ? "answered" : ""}`}
              key={question.id}
              onClick={() => selectQuestion(questionIndex)}
              type="button"
            >{questionIndex + 1}</button>
          ))}
        </div>
      </div>

      <div className="panel dictation-prompt-card">
        {current.promptType === "audio" ? (
          <div className="audio-prompt">
            <div className="audio-prompt-main">
              <p className="prompt dictation-prompt-title">{currentEntryType === "phrase" ? "听英文词组" : "听英文发音"}</p>
              <button className="play-button" disabled={speechLoading} onClick={speak} type="button">
                <Volume2 size={24} /> {speechLoading ? "准备中..." : "播放"}
              </button>
            </div>
            <div className="audio-controls">
              <label>
                声音
                <select value={cloudVoiceId} onChange={(event) => setCloudVoiceId(event.target.value as CloudSpeechVoiceId)}>
                  {CLOUD_SPEECH_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
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
            {speechMessage ? <p className="speech-message" role="status">{speechMessage}</p> : null}
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

          <div className="dictation-actions">
            {!isDone ? <button className="secondary" disabled={loading} onClick={skipQuestion} type="button">
              <SkipForward size={19} /> 暂时不会
            </button> : null}
            <button className="submit-answer-button" disabled={loading} onClick={submit} type="button">
              <Check size={20} /> {loading ? "提交中..." : answeredIds.has(current.id) ? "保存本题修改" : "提交并进入下一题"}
            </button>
          </div>
          {message ? <p className="muted answer-message">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
