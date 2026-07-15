"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LockKeyhole, LogOut, Save, Search, Trash2, Upload, Volume2 } from "lucide-react";
import { speechTextForWord } from "@/lib/dictation";
import { CLOUD_SPEECH_VOICES, type CloudSpeechVoiceId } from "@/lib/cloud-speech";
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

function sourceLabel(value?: string) {
  if (value === "base") return "基础词库";
  if (value === "upload") return "上传词库";
  return "自定义";
}

type ApiPayload = {
  error?: string;
  words?: unknown;
  word?: WordEntry;
  createdCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  matchedCount?: number;
};

type SessionPayload = { configured?: boolean; authenticated?: boolean; error?: string };

type ClearTarget = {
  key: string;
  label: string;
  mode: "stage" | "source" | "uploadBatch";
  value: string;
  count: number;
};

async function readApiResponse(response: Response, fallbackMessage: string): Promise<ApiPayload> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage}：服务器没有返回内容，请稍后重试`);
  }

  try {
    return JSON.parse(text) as ApiPayload;
  } catch {
    throw new Error(`${fallbackMessage}：服务器返回了无法识别的内容（HTTP ${response.status}）`);
  }
}

export function LibraryManager() {
  const pageSize = 80;
  const [words, setWords] = useState<WordEntry[]>([]);
  const [preview, setPreview] = useState<ImportPreviewWord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingWordId, setSavingWordId] = useState<string | null>(null);
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearTargetKey, setClearTargetKey] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [saveMode, setSaveMode] = useState<"recent" | "stage">("recent");
  const [targetStage, setTargetStage] = useState("junior");
  const [page, setPage] = useState(1);
  const [speakingWordId, setSpeakingWordId] = useState<string | null>(null);
  const [cloudVoiceId, setCloudVoiceId] = useState<CloudSpeechVoiceId>("female");
  const [speechRate, setSpeechRate] = useState(0.78);
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function loadWords() {
    try {
      const response = await fetch("/api/words", { cache: "no-store" });
      const data = await readApiResponse(response, "加载词库失败");
      if (!response.ok) throw new Error(data.error ?? "加载词库失败");
      setWords(Array.isArray(data.words) ? (data.words as WordEntry[]) : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载词库失败");
    }
  }

  useEffect(() => {
    loadWords();
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: SessionPayload) => {
        setAdminConfigured(Boolean(data.configured));
        setAuthenticated(Boolean(data.authenticated));
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const mistakeCount = useMemo(() => words.filter((word) => word.stats.wrongCount > 0).length, [words]);
  const clearTargets = useMemo<ClearTarget[]>(() => {
    const stageTargets = vocabularyStages
      .map((stage) => ({
        key: `stage:${stage.key}`,
        label: `${stage.label}阶段`,
        mode: "stage" as const,
        value: stage.key,
        count: words.filter((word) => (word.stages ?? []).includes(stage.key)).length
      }))
      .filter((item) => item.count > 0);

    const sourceTargets = (["base", "upload", "custom"] as const)
      .map((source) => ({
        key: `source:${source}`,
        label: sourceLabel(source),
        mode: "source" as const,
        value: source,
        count: words.filter((word) => (word.source ?? "custom") === source).length
      }))
      .filter((item) => item.count > 0);

    const uploadBatchMap = new Map<string, { name: string; count: number }>();
    for (const word of words) {
      if (word.source !== "upload" || !word.uploadBatchId) continue;
      const current = uploadBatchMap.get(word.uploadBatchId) ?? { name: word.uploadBatchName || "上传批次", count: 0 };
      current.count += 1;
      if (word.uploadBatchName) current.name = word.uploadBatchName;
      uploadBatchMap.set(word.uploadBatchId, current);
    }
    const uploadBatchTargets = Array.from(uploadBatchMap.entries()).map(([id, item]) => ({
      key: `uploadBatch:${id}`,
      label: item.name,
      mode: "uploadBatch" as const,
      value: id,
      count: item.count
    }));

    return [...stageTargets, ...sourceTargets, ...uploadBatchTargets];
  }, [words]);

  useEffect(() => {
    if (!clearTargets.length) {
      setClearTargetKey("");
      return;
    }
    if (!clearTargets.some((target) => target.key === clearTargetKey)) {
      setClearTargetKey(clearTargets[0].key);
    }
  }, [clearTargetKey, clearTargets]);

  const selectedClearTarget = useMemo(
    () => clearTargets.find((target) => target.key === clearTargetKey),
    [clearTargetKey, clearTargets]
  );

  const filteredWords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return words
      .filter((word) => stageFilter === "all" || (word.stages ?? []).includes(stageFilter))
      .filter((word) => !keyword || [word.word, word.phonetic ?? "", word.partOfSpeech, word.meaning, word.unit ?? "", joinList(word.tags), joinList(word.stages)].some(
        (value) => value.toLowerCase().includes(keyword)
      ) || entryTypeLabel(word.entryType).includes(keyword)
    );
  }, [query, stageFilter, words]);
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize));
  const visibleWords = useMemo(() => filteredWords.slice((page - 1) * pageSize, page * pageSize), [filteredWords, page]);

  useEffect(() => setPage(1), [query, stageFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  function speakWithBrowser(word: WordEntry) {
    if (!("speechSynthesis" in window)) return setMessage("当前浏览器不支持备用发音。");
    const utterance = new SpeechSynthesisUtterance(speechTextForWord(word.word));
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    utterance.onstart = () => setSpeakingWordId(word.id);
    utterance.onend = () => setSpeakingWordId(null);
    utterance.onerror = () => { setSpeakingWordId(null); setMessage("发音失败，请检查设备媒体音量。"); };
    window.speechSynthesis.speak(utterance);
  }

  function speakWord(word: WordEntry) {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeakingWordId(word.id);
    setMessage("");
    const audio = new Audio(`/api/words/${encodeURIComponent(word.id)}/speech?voice=${cloudVoiceId}`);
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

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await response.json() as SessionPayload;
    if (!response.ok) {
      setMessage(data.error ?? "教师登录失败");
      return;
    }
    setAuthenticated(true);
    setPassword("");
    setMessage("教师权限已解锁");
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setMessage("已退出教师权限，词库切换为只读模式");
    await loadWords();
  }

  async function uploadFile(formData: FormData) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const data = await readApiResponse(response, "解析失败");
      if (!response.ok) throw new Error(data.error ?? "解析失败");
      const importedWords = Array.isArray(data.words) ? (data.words as ImportPreviewWord[]) : [];
      setPreview(importedWords);
      setMessage(`解析出 ${importedWords.length} 个候选单词，请确认后保存`);
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
      const data = await readApiResponse(response, "保存失败");
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      setPreview([]);
      await loadWords();
      const savedCount = Array.isArray(data.words) ? data.words.length : 0;
      setMessage(`已保存 ${savedCount} 个单词，新增 ${data.createdCount ?? 0} 个，更新 ${data.updatedCount ?? 0} 个`);
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
      const data = await readApiResponse(response, "保存失败");
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      if (!data.word) throw new Error("保存失败：服务器没有返回单词信息");
      const savedWord = data.word;
      setWords((items) => items.map((item) => (item.id === word.id ? savedWord : item)));
      setMessage(`已更新：${savedWord.word}`);
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
      const data = await readApiResponse(response, "删除失败");
      if (!response.ok) throw new Error(data.error ?? "删除失败");
      setWords((items) => items.filter((item) => item.id !== word.id));
      setMessage(`已删除：${word.word}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingWordId(null);
    }
  }

  async function clearSelectedWords() {
    if (!selectedClearTarget) {
      setMessage("没有可清空的词库类型");
      return;
    }

    const confirmed = window.confirm(
      `确定清空“${selectedClearTarget.label}”下的 ${selectedClearTarget.count} 个词条吗？此操作不可撤销。`
    );
    if (!confirmed) return;

    setClearing(true);
    setMessage("");
    try {
      const response = await fetch("/api/words", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedClearTarget.mode, value: selectedClearTarget.value })
      });
      const data = await readApiResponse(response, "清空失败");
      if (!response.ok) throw new Error(data.error ?? "清空失败");
      if (Array.isArray(data.words)) setWords(data.words as WordEntry[]);
      else await loadWords();
      setMessage(
        `已清空 ${selectedClearTarget.label}：删除 ${data.deletedCount ?? 0} 个词条${
          data.updatedCount ? `，保留并移除阶段 ${data.updatedCount} 个` : ""
        }`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空失败");
    } finally {
      setClearing(false);
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

      <section className="panel library-permission-bar">
        {authenticated ? (
          <>
            <span className="pill ok"><LockKeyhole size={15} /> 教师编辑模式</span>
            <button className="secondary" onClick={logout} type="button"><LogOut size={17} /> 退出编辑</button>
          </>
        ) : adminConfigured ? (
          <form className="library-login-form" onSubmit={login}>
            <span className="muted">当前为只读模式，教师登录后可新增、修改或删除。</span>
            <input aria-label="教师管理密码" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="教师管理密码" type="password" value={password} />
            <button type="submit"><LockKeyhole size={17} /> 解锁编辑</button>
          </form>
        ) : <span className="wrong">尚未配置教师密码，词库修改和删除已禁用。</span>}
      </section>

      {authenticated ? <section className="panel">
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
      </section> : null}

      {authenticated ? <section className="panel danger-zone">
        <div>
          <h2 style={{ margin: 0 }}>清空词库</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            按阶段或来源类型批量清理。
          </p>
        </div>
        <div className="form clear-library-form">
          <label>
            阶段/来源
            <select value={clearTargetKey} onChange={(event) => setClearTargetKey(event.target.value)} disabled={!clearTargets.length}>
              <optgroup label="阶段">
                {clearTargets
                  .filter((target) => target.mode === "stage")
                  .map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.label}（{target.count}）
                    </option>
                  ))}
              </optgroup>
              <optgroup label="来源">
                {clearTargets
                  .filter((target) => target.mode === "source")
                  .map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.label}（{target.count}）
                    </option>
                  ))}
              </optgroup>
              <optgroup label="上传批次">
                {clearTargets
                  .filter((target) => target.mode === "uploadBatch")
                  .map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.label}（{target.count}）
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <button className="danger" disabled={clearing || !selectedClearTarget} onClick={clearSelectedWords} type="button">
            <Trash2 size={18} /> {clearing ? "清空中..." : "一键清空"}
          </button>
        </div>
      </section> : null}

      {authenticated && preview.length ? (
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
          <div className="table-scroll">
            <table className="library-table preview-table">
              <colgroup>
                <col className="col-word" />
                <col className="col-type" />
                <col className="col-phonetic" />
                <col className="col-pos" />
                <col className="col-meaning" />
                <col className="col-stage" />
                <col className="col-unit" />
                <col className="col-tags" />
                <col className="col-notes" />
              </colgroup>
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
              共 {words.length} 个单词，筛选到 {filteredWords.length} 个；当前第 {page}/{totalPages} 页。
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
          <label className="library-voice-select">
            阶段筛选
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              <option value="all">全部阶段</option>
              {vocabularyStages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
            </select>
          </label>
          <label className="library-voice-select">
            发音声音
            <select value={cloudVoiceId} onChange={(event) => setCloudVoiceId(event.target.value as CloudSpeechVoiceId)}>
              {CLOUD_SPEECH_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
            </select>
          </label>
          <label className="library-speed-control">
            播放速度：{speechRate.toFixed(2)}
            <input min={0.55} max={1} step={0.05} type="range" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} />
          </label>
        </div>
        <div className="table-scroll">
          <table className="library-table saved-words-table">
            <colgroup>
              <col className="col-word" />
              <col className="col-type" />
              <col className="col-phonetic" />
              <col className="col-pos" />
              <col className="col-meaning" />
              <col className="col-source" />
              <col className="col-unit" />
              <col className="col-tags" />
              <col className="col-status" />
              <col className="col-actions" />
            </colgroup>
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
              {visibleWords.map((word) => (
                <tr key={word.id}>
                  <td>
                    <input disabled={!authenticated} value={word.word} onChange={(event) => updateSavedWord(word.id, { word: event.target.value })} />
                  </td>
                  <td>
                    <select
                      disabled={!authenticated}
                      value={word.entryType ?? "word"}
                      onChange={(event) => updateSavedWord(word.id, { entryType: event.target.value as "word" | "phrase" })}
                    >
                      <option value="word">单词</option>
                      <option value="phrase">词组</option>
                    </select>
                  </td>
                  <td>
                    <input disabled={!authenticated} value={word.phonetic ?? ""} onChange={(event) => updateSavedWord(word.id, { phonetic: event.target.value })} />
                  </td>
                  <td>
                    <input
                      disabled={!authenticated}
                      value={word.partOfSpeech}
                      onChange={(event) => updateSavedWord(word.id, { partOfSpeech: event.target.value })}
                    />
                  </td>
                  <td>
                    <textarea disabled={!authenticated} value={word.meaning} onChange={(event) => updateSavedWord(word.id, { meaning: event.target.value })} />
                  </td>
                  <td>
                    <input
                      disabled={!authenticated}
                      value={joinList(word.stages?.map(stageLabel))}
                      onChange={(event) => updateSavedWord(word.id, { stages: splitList(event.target.value) })}
                    />
                    <div className="muted table-subtext" title={word.uploadBatchName || undefined}>
                      {word.source === "upload" ? word.uploadBatchName || "本次上传" : word.source === "base" ? "基础词库" : "自定义"}
                    </div>
                  </td>
                  <td>
                    <input disabled={!authenticated} value={word.unit ?? ""} onChange={(event) => updateSavedWord(word.id, { unit: event.target.value })} />
                  </td>
                  <td>
                    <input disabled={!authenticated} value={joinList(word.tags)} onChange={(event) => updateSavedWord(word.id, { tags: splitList(event.target.value) })} />
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
                      {authenticated ? <button
                        aria-label={`播放 ${word.word}`}
                        className="secondary"
                        onClick={() => speakWord(word)}
                        title="播放读音"
                        type="button"
                      >
                        <Volume2 size={18} className={speakingWordId === word.id ? "speaking-icon" : ""} />
                      </button> : null}
                      {authenticated ? <button
                        aria-label={`保存 ${word.word}`}
                        disabled={savingWordId === word.id || deletingWordId === word.id}
                        onClick={() => saveSavedWord(word)}
                        title="保存"
                        type="button"
                      >
                        <Save size={18} />
                      </button> : null}
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
        {filteredWords.length > pageSize ? (
          <div className="pagination-bar">
            <button className="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">上一页</button>
            <span className="muted">第 {page} / {totalPages} 页</span>
            <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">下一页</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
