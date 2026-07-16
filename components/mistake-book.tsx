"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Trash2, Volume2 } from "lucide-react";
import { CLOUD_SPEECH_VOICES, type CloudSpeechVoiceId } from "@/lib/cloud-speech";
import { speechTextForWord } from "@/lib/dictation";
import type { FieldName, WordEntry } from "@/lib/types";

const fieldLabels: Record<FieldName, string> = {
  word: "英文",
  partOfSpeech: "词性",
  meaning: "中文"
};

const proficiencyLabels = {
  new: "新错词",
  learning: "学习中",
  review: "待巩固",
  mastered: "已掌握"
} as const;

function reviewLabel(value?: string) {
  if (!value) return "完成一次复习后安排";
  const date = new Date(value);
  if (date.getTime() <= Date.now()) return "现在应复习";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

export function MistakeBook() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filter, setFilter] = useState<"all" | FieldName>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "learning" | "review" | "mastered">("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [authenticated, setAuthenticated] = useState(false);
  const [savingWordId, setSavingWordId] = useState<string | null>(null);
  const [clearingWordId, setClearingWordId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [cloudVoiceId, setCloudVoiceId] = useState<CloudSpeechVoiceId>("male");
  const [speechRate, setSpeechRate] = useState(1);
  const [speakingWordId, setSpeakingWordId] = useState<string | null>(null);
  const [speechSource, setSpeechSource] = useState<{ wordId: string; source: "cache" | "generated" | "browser" } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function loadWords() {
    const response = await fetch("/api/words", { cache: "no-store" });
    const data = await response.json();
    setWords(data.words ?? []);
  }

  useEffect(() => {
    loadWords().catch(() => setWords([]));
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const people = useMemo(() => Array.from(new Set(words.flatMap((word) => Object.keys(word.stats.mistakePeople ?? {})))).sort(), [words]);

  function updateWord(wordId: string, patch: Partial<WordEntry>) {
    setWords((items) => items.map((word) => (word.id === wordId ? { ...word, ...patch } : word)));
  }

  function speakWithBrowser(word: WordEntry) {
    if (!("speechSynthesis" in window)) return setMessage("当前浏览器不支持备用发音。");
    const utterance = new SpeechSynthesisUtterance(speechTextForWord(word.word));
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    utterance.onstart = () => setSpeakingWordId(word.id);
    utterance.onend = () => setSpeakingWordId(null);
    utterance.onerror = () => { setSpeakingWordId(null); setMessage("发音失败，请检查设备媒体音量。"); };
    window.speechSynthesis.speak(utterance);
    setSpeechSource({ wordId: word.id, source: "browser" });
  }

  async function speakWord(word: WordEntry) {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeakingWordId(word.id);
    setMessage("");
    let speech: { url: string; source: "cache" | "generated" };
    try {
      const response = await fetch(`/api/words/${encodeURIComponent(word.id)}/speech?voice=${cloudVoiceId}`, { cache: "no-store" });
      const data = await response.json() as { url?: string; source?: "cache" | "generated"; error?: string };
      if (!response.ok || !data.url || !data.source) throw new Error(data.error ?? "云端发音不可用");
      speech = { url: data.url, source: data.source };
      setSpeechSource({ wordId: word.id, source: data.source });
    } catch {
      setMessage("云端发音暂不可用，已切换到浏览器发音。");
      speakWithBrowser(word);
      return;
    }

    const audio = new Audio(speech.url);
    audio.playbackRate = speechRate;
    audio.preservesPitch = true;
    audioRef.current = audio;
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      audio.onerror = null;
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
      setMessage("云端发音暂不可用，已切换到浏览器发音。");
      speakWithBrowser(word);
    };
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setSpeakingWordId(null);
    };
    audio.onerror = fallback;
    void audio.play().catch(fallback);
  }

  async function saveWord(word: WordEntry) {
    setSavingWordId(word.id);
    setMessage("");
    try {
      const response = await fetch(`/api/words/${word.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.word,
          entryType: word.entryType ?? "word",
          phonetic: word.phonetic ?? "",
          partOfSpeech: word.partOfSpeech,
          meaning: word.meaning,
          unit: word.unit ?? "",
          tags: word.tags ?? [],
          notes: word.notes ?? "",
          stages: word.stages ?? []
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      setWords((items) => items.map((item) => (item.id === word.id ? data.word : item)));
      setMessage(`已更新：${data.word.word}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingWordId(null);
    }
  }

  async function clearMistake(word: WordEntry) {
    const confirmed = window.confirm(`确定从错词本移除“${word.word}”吗？`);
    if (!confirmed) return;

    setClearingWordId(word.id);
    setMessage("");
    try {
      const response = await fetch(`/api/mistakes/${word.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "移除失败");
      setWords((items) => items.map((item) => (item.id === word.id ? data.word : item)));
      setMessage(`已从错词本移除：${word.word}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "移除失败");
    } finally {
      setClearingWordId(null);
    }
  }

  async function clearAllMistakes() {
    const mistakeCount = words.filter((word) => word.stats.wrongCount > 0).length;
    if (!mistakeCount) return;
    const confirmed = window.confirm(`确定清空全部 ${mistakeCount} 个错词记录吗？`);
    if (!confirmed) return;

    setClearingAll(true);
    setMessage("");
    try {
      const response = await fetch("/api/mistakes", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "清空失败");
      await loadWords();
      setMessage(`已清空 ${data.clearedCount ?? 0} 个错词记录`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空失败");
    } finally {
      setClearingAll(false);
    }
  }

  const mistakes = useMemo(() => {
    return words
      .filter((word) => word.stats.wrongCount > 0)
      .filter((word) => filter === "all" || (word.stats.fieldWrongCounts[filter] ?? 0) > 0)
      .filter((word) => statusFilter === "all" || (statusFilter === "due"
        ? Boolean(word.stats.nextReviewAt && new Date(word.stats.nextReviewAt).getTime() <= Date.now())
        : word.stats.proficiency === statusFilter))
      .filter((word) => personFilter === "all" || (word.stats.mistakePeople?.[personFilter] ?? 0) > 0)
      .sort((a, b) => b.stats.wrongCount - a.stats.wrongCount);
  }, [filter, personFilter, statusFilter, words]);

  return (
    <div className="grid">
      <section className="grid cols-3">
        <div className="panel stat">
          <strong>{mistakes.length}</strong>
          <span>当前筛选错词</span>
        </div>
        <div className="panel stat">
          <strong>{words.filter((word) => word.stats.proficiency === "mastered").length}</strong>
          <span>已掌握</span>
        </div>
        <div className="panel stat">
          <strong>{words.reduce((sum, word) => sum + word.stats.wrongCount, 0)}</strong>
          <span>累计错误记录</span>
        </div>
      </section>

      <section className="panel">
        <div className="topbar" style={{ marginBottom: 0 }}>
          <label>
            错误类型
            <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | FieldName)}>
              <option value="all">全部</option>
              <option value="word">英文拼写</option>
              <option value="partOfSpeech">词性</option>
              <option value="meaning">中文意思</option>
            </select>
          </label>
          <label>
            听写人
            <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}>
              <option value="all">全部听写人</option>
              {people.map((person) => <option key={person} value={person}>{person}</option>)}
            </select>
          </label>
          <label>
            复习状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">全部状态</option>
              <option value="due">现在应复习</option>
              <option value="learning">学习中</option>
              <option value="review">待巩固</option>
              <option value="mastered">已掌握</option>
            </select>
          </label>
          <label>
            发音声音
            <select value={cloudVoiceId} onChange={(event) => setCloudVoiceId(event.target.value as CloudSpeechVoiceId)}>
              {CLOUD_SPEECH_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
            </select>
          </label>
          <label className="mistake-speed-control">
            播放速度：{speechRate.toFixed(2)}
            <input min={0.5} max={1.5} step={0.05} type="range" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} />
          </label>
          {authenticated ? <button className="danger" disabled={clearingAll || !words.some((word) => word.stats.wrongCount > 0)} onClick={clearAllMistakes} type="button">
            <Trash2 size={18} /> 一键清空错词
          </button> : <span className="pill">只读模式</span>}
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </section>

      <section className="panel">
        <div className="table-scroll">
          <table className="mistake-table">
            <thead>
              <tr>
                <th>英文</th>
                <th>类型</th>
                <th>词性</th>
                <th>中文意思</th>
                <th>错误次数</th>
                <th>错误位置</th>
                <th>听写人</th>
                <th>连续答对</th>
                <th>熟练度 / 下次复习</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((word) => (
                <tr key={word.id}>
                  <td>
                    {authenticated ? <input value={word.word} onChange={(event) => updateWord(word.id, { word: event.target.value })} /> : <strong>{word.word}</strong>}
                  </td>
                  <td>
                    {authenticated ? <select
                      value={word.entryType ?? "word"}
                      onChange={(event) => updateWord(word.id, { entryType: event.target.value as "word" | "phrase" })}
                    >
                      <option value="word">单词</option>
                      <option value="phrase">词组</option>
                    </select> : word.entryType === "phrase" ? "词组" : "单词"}
                  </td>
                  <td>
                    {authenticated ? <input value={word.partOfSpeech} onChange={(event) => updateWord(word.id, { partOfSpeech: event.target.value })} /> : word.partOfSpeech || "-"}
                  </td>
                  <td>
                    {authenticated ? <textarea value={word.meaning} onChange={(event) => updateWord(word.id, { meaning: event.target.value })} /> : word.meaning}
                  </td>
                  <td>
                    <span className="pill wrong">{word.stats.wrongCount}</span>
                  </td>
                  <td>
                    {Object.entries(word.stats.fieldWrongCounts).map(([field, count]) => (
                      <span className="pill" key={field} style={{ marginRight: 6 }}>
                        {fieldLabels[field as FieldName]} {count}
                      </span>
                    ))}
                  </td>
                  <td>{Object.entries(word.stats.mistakePeople ?? {}).map(([person, count]) => <span className="pill person-pill" key={person}>{person} {count}</span>)}</td>
                  <td>{word.stats.consecutiveCorrect}</td>
                  <td>
                    <span className={`status-badge ${word.stats.proficiency ?? "new"}`}>
                      {proficiencyLabels[word.stats.proficiency ?? "new"]}
                    </span>
                    <div className="table-subtext">{reviewLabel(word.stats.nextReviewAt)}</div>
                  </td>
                  <td>
                    <div className="row-actions mistake-row-actions">
                      <button aria-label={`播放 ${word.word}`} className="secondary" onClick={() => void speakWord(word)} title="播放读音" type="button">
                        <Volume2 size={18} className={speakingWordId === word.id ? "speaking-icon" : ""} />
                      </button>
                      {authenticated ? <>
                      <button
                        aria-label={`保存 ${word.word}`}
                        disabled={savingWordId === word.id || clearingWordId === word.id}
                        onClick={() => saveWord(word)}
                        title="保存"
                        type="button"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        aria-label={`从错词本移除 ${word.word}`}
                        className="danger"
                        disabled={savingWordId === word.id || clearingWordId === word.id}
                        onClick={() => clearMistake(word)}
                        title="从错词本移除"
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                      </> : null}
                      {speechSource?.wordId === word.id ? <span className={`speech-source ${speechSource.source}`}>
                        {speechSource.source === "generated" ? "百度云生成" : speechSource.source === "cache" ? "Supabase 缓存" : "浏览器备用"}
                      </span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!mistakes.length ? (
                <tr>
                  <td colSpan={10} className="muted">
                    暂时还没有错词。完成一次听写后，这里会自动更新。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
