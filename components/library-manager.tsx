"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Search, Trash2, Upload } from "lucide-react";
import type { ImportPreviewWord, WordEntry } from "@/lib/types";
import { stageLabel, vocabularyStages } from "@/lib/vocabulary";

function splitList(value = "") {
  return value
    .split(/[、，,；;\/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value?: string[]) {
  return (value ?? []).join("；");
}

function entryTypeLabel(value?: string) {
  return value === "phrase" ? "词组" : "单词";
}

export function LibraryManager() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [preview, setPreview] = useState<ImportPreviewWord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingWordId, setSavingWordId] = useState<string | null>(null);
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saveMode, setSaveMode] = useState<"recent" | "stage">("recent");
  const [targetStage, setTargetStage] = useState("junior");

  async function loadWords() {
    const response = await fetch("/api/words", { cache: "no-store" });
    const data = await response.json();
    setWords(data.words ?? []);
  }

  useEffect(() => {
    loadWords();
  }, []);

  const mistakeCount = useMemo(() => words.filter((word) => word.stats.wrongCount > 0).length, [words]);
  const filteredWords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return words;

    return words.filter((word) =>
      [word.word, word.phonetic ?? "", word.partOfSpeech, word.meaning, word.unit ?? "", joinList(word.tags), joinList(word.stages)].some(
        (value) => value.toLowerCase().includes(keyword)
      ) || entryTypeLabel(word.entryType).includes(keyword)
    );
  }, [query, words]);

  async function uploadFile(formData: FormData) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "解析失败");
      setPreview(data.words ?? []);
      setMessage(`解析出 ${data.words?.length ?? 0} 个候选单词，请确认后保存`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function savePreview() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: preview, saveMode, stage: targetStage })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      setPreview([]);
      await loadWords();
      setMessage(`已保存 ${data.words?.length ?? 0} 个单词，新增 ${data.createdCount ?? 0} 个，更新 ${data.updatedCount ?? 0} 个`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  function updatePreview(index: number, patch: Partial<ImportPreviewWord>) {
    setPreview((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function updateSavedWord(wordId: string, patch: Partial<ImportPreviewWord>) {
    setWords((items) => items.map((item) => (item.id === wordId ? { ...item, ...patch } : item)));
  }

  async function saveSavedWord(word: WordEntry) {
    setSavingWordId(word.id);
    setMessage("");
    try {
      const response = await fetch(`/api/words/${word.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.word,
          entryType: word.entryType ?? "word",
          partOfSpeech: word.partOfSpeech,
          meaning: word.meaning,
          phonetic: word.phonetic ?? "",
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

  async function deleteSavedWord(word: WordEntry) {
    const confirmed = window.confirm(`确定删除“${word.word}”吗？`);
    if (!confirmed) return;

    setDeletingWordId(word.id);
    setMessage("");
    try {
      const response = await fetch(`/api/words/${word.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "删除失败");
      setWords((items) => items.filter((item) => item.id !== word.id));
      setMessage(`已删除：${word.word}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingWordId(null);
    }
  }

  return (
    <div className="grid">
      <section className="grid cols-3">
        <div className="panel stat">
          <strong>{words.length}</strong>
          <span>词库单词</span>
        </div>
        <div className="panel stat">
          <strong>{mistakeCount}</strong>
          <span>已记录错词</span>
        </div>
        <div className="panel stat">
          <strong>{preview.length}</strong>
          <span>等待确认</span>
        </div>
      </section>

      <section className="panel">
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault();
            await uploadFile(new FormData(event.currentTarget));
          }}
        >
          <label>
            上传固定模板
            <input name="file" type="file" accept=".xlsx,.csv" required />
          </label>
          <div className="row-actions">
            <a className="button secondary" href="/api/word-template">
              下载 Excel 模板
            </a>
          </div>
          <button disabled={loading} type="submit">
            <Upload size={18} /> {loading ? "处理中..." : "解析文件"}
          </button>
        </form>
        {message ? <p className="muted">{message}</p> : null}
      </section>

      {preview.length ? (
        <section className="panel">
          <div className="topbar" style={{ marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0 }}>导入预览</h2>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                学校文档格式不稳定，保存前可以直接修正。
              </p>
            </div>
            <div className="form compact-form">
              <label>
                上传用途
                <select value={saveMode} onChange={(event) => setSaveMode(event.target.value as "recent" | "stage")}>
                  <option value="recent">仅作为本次上传词库</option>
                  <option value="stage">更新到基础词汇表</option>
                </select>
              </label>
              {saveMode === "stage" ? (
                <label>
                  基础词汇表
                  <select value={targetStage} onChange={(event) => setTargetStage(event.target.value)}>
                    {vocabularyStages.map((stage) => (
                      <option key={stage.key} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button disabled={loading} onClick={savePreview} type="button">
                <Save size={18} /> 保存上传结果
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>英文</th>
                  <th>类型</th>
                  <th>音标</th>
                  <th>词性</th>
                  <th>中文意思</th>
                  <th>阶段</th>
                  <th>单元</th>
                  <th>标签</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((word, index) => (
                  <tr key={`${word.word}-${index}`}>
                    <td>
                      <input value={word.word} onChange={(event) => updatePreview(index, { word: event.target.value })} />
                    </td>
                    <td>
                      <select
                        value={word.entryType ?? "word"}
                        onChange={(event) => updatePreview(index, { entryType: event.target.value as "word" | "phrase" })}
                      >
                        <option value="word">单词</option>
                        <option value="phrase">词组</option>
                      </select>
                    </td>
                    <td>
                      <input value={word.phonetic ?? ""} onChange={(event) => updatePreview(index, { phonetic: event.target.value })} />
                    </td>
                    <td>
                      <input
                        value={word.partOfSpeech}
                        onChange={(event) => updatePreview(index, { partOfSpeech: event.target.value })}
                      />
                    </td>
                    <td>
                      <input value={word.meaning} onChange={(event) => updatePreview(index, { meaning: event.target.value })} />
                    </td>
                    <td>
                      <input
                        value={joinList(word.stages)}
                        onChange={(event) => updatePreview(index, { stages: splitList(event.target.value) })}
                      />
                    </td>
                    <td>
                      <input value={word.unit ?? ""} onChange={(event) => updatePreview(index, { unit: event.target.value })} />
                    </td>
                    <td>
                      <input value={joinList(word.tags)} onChange={(event) => updatePreview(index, { tags: splitList(event.target.value) })} />
                    </td>
                    <td>
                      <input value={word.notes ?? ""} onChange={(event) => updatePreview(index, { notes: event.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="topbar" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>当前词库</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              共 {words.length} 个单词，当前显示 {filteredWords.length} 个。
            </p>
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="搜索词库"
              placeholder="搜索英文、词性、中文意思"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>英文</th>
                <th>类型</th>
                <th>音标</th>
                <th>词性</th>
                <th>中文意思</th>
                <th>阶段/来源</th>
                <th>单元</th>
                <th>标签</th>
                <th>错词状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredWords.map((word) => (
                <tr key={word.id}>
                  <td>
                    <input value={word.word} onChange={(event) => updateSavedWord(word.id, { word: event.target.value })} />
                  </td>
                  <td>
                    <select
                      value={word.entryType ?? "word"}
                      onChange={(event) => updateSavedWord(word.id, { entryType: event.target.value as "word" | "phrase" })}
                    >
                      <option value="word">单词</option>
                      <option value="phrase">词组</option>
                    </select>
                  </td>
                  <td>
                    <input value={word.phonetic ?? ""} onChange={(event) => updateSavedWord(word.id, { phonetic: event.target.value })} />
                  </td>
                  <td>
                    <input
                      value={word.partOfSpeech}
                      onChange={(event) => updateSavedWord(word.id, { partOfSpeech: event.target.value })}
                    />
                  </td>
                  <td>
                    <textarea value={word.meaning} onChange={(event) => updateSavedWord(word.id, { meaning: event.target.value })} />
                  </td>
                  <td>
                    <input
                      value={joinList(word.stages?.map(stageLabel))}
                      onChange={(event) => updateSavedWord(word.id, { stages: splitList(event.target.value) })}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {word.source === "upload" ? word.uploadBatchName || "本次上传" : word.source === "base" ? "基础词库" : "自定义"}
                    </div>
                  </td>
                  <td>
                    <input value={word.unit ?? ""} onChange={(event) => updateSavedWord(word.id, { unit: event.target.value })} />
                  </td>
                  <td>
                    <input value={joinList(word.tags)} onChange={(event) => updateSavedWord(word.id, { tags: splitList(event.target.value) })} />
                  </td>
                  <td>
                    {word.stats.wrongCount ? (
                      <span className="pill wrong">错 {word.stats.wrongCount} 次</span>
                    ) : (
                      <span className="pill ok">未错</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        aria-label={`保存 ${word.word}`}
                        disabled={savingWordId === word.id || deletingWordId === word.id}
                        onClick={() => saveSavedWord(word)}
                        title="保存"
                        type="button"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        aria-label={`删除 ${word.word}`}
                        className="danger"
                        disabled={savingWordId === word.id || deletingWordId === word.id}
                        onClick={() => deleteSavedWord(word)}
                        title="删除"
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredWords.length ? (
                <tr>
                  <td colSpan={10} className="muted">
                    {words.length ? "没有匹配的单词。" : "还没有单词，先上传一份学校单词表。"}
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
