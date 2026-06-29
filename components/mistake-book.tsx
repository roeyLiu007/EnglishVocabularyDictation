"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import type { FieldName, WordEntry } from "@/lib/types";

const fieldLabels: Record<FieldName, string> = {
  word: "英文",
  partOfSpeech: "词性",
  meaning: "中文"
};

export function MistakeBook() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filter, setFilter] = useState<"all" | FieldName>("all");
  const [savingWordId, setSavingWordId] = useState<string | null>(null);
  const [clearingWordId, setClearingWordId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [message, setMessage] = useState("");

  async function loadWords() {
    const response = await fetch("/api/words", { cache: "no-store" });
    const data = await response.json();
    setWords(data.words ?? []);
  }

  useEffect(() => {
    loadWords().catch(() => setWords([]));
  }, []);

  function updateWord(wordId: string, patch: Partial<WordEntry>) {
    setWords((items) => items.map((word) => (word.id === wordId ? { ...word, ...patch } : word)));
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
      .sort((a, b) => b.stats.wrongCount - a.stats.wrongCount);
  }, [filter, words]);

  return (
    <div className="grid">
      <section className="grid cols-3">
        <div className="panel stat">
          <strong>{mistakes.length}</strong>
          <span>当前筛选错词</span>
        </div>
        <div className="panel stat">
          <strong>{words.filter((word) => word.stats.consecutiveCorrect >= 3).length}</strong>
          <span>连续答对 3 次</span>
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
          <button className="danger" disabled={clearingAll || !words.some((word) => word.stats.wrongCount > 0)} onClick={clearAllMistakes} type="button">
            <Trash2 size={18} /> 一键清空错词
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </section>

      <section className="panel">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>英文</th>
                <th>音标</th>
                <th>词性</th>
                <th>中文意思</th>
                <th>错误次数</th>
                <th>错误位置</th>
                <th>连续答对</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((word) => (
                <tr key={word.id}>
                  <td>
                    <input value={word.word} onChange={(event) => updateWord(word.id, { word: event.target.value })} />
                  </td>
                  <td>
                    <input value={word.phonetic ?? ""} onChange={(event) => updateWord(word.id, { phonetic: event.target.value })} />
                  </td>
                  <td>
                    <input value={word.partOfSpeech} onChange={(event) => updateWord(word.id, { partOfSpeech: event.target.value })} />
                  </td>
                  <td>
                    <textarea value={word.meaning} onChange={(event) => updateWord(word.id, { meaning: event.target.value })} />
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
                  <td>{word.stats.consecutiveCorrect}</td>
                  <td>
                    <div className="row-actions">
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
                    </div>
                  </td>
                </tr>
              ))}
              {!mistakes.length ? (
                <tr>
                  <td colSpan={8} className="muted">
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
