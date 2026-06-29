"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldName, WordEntry } from "@/lib/types";

const fieldLabels: Record<FieldName, string> = {
  word: "英文",
  partOfSpeech: "词性",
  meaning: "中文"
};

export function MistakeBook() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filter, setFilter] = useState<"all" | FieldName>("all");

  useEffect(() => {
    fetch("/api/words", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setWords(data.words ?? []));
  }, []);

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
        <label>
          错误类型
          <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | FieldName)}>
            <option value="all">全部</option>
            <option value="word">英文拼写</option>
            <option value="partOfSpeech">词性</option>
            <option value="meaning">中文意思</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>英文</th>
                <th>词性</th>
                <th>中文意思</th>
                <th>错误次数</th>
                <th>错误位置</th>
                <th>连续答对</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.map((word) => (
                <tr key={word.id}>
                  <td>{word.word}</td>
                  <td>{word.partOfSpeech || "-"}</td>
                  <td>{word.meaning}</td>
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
                </tr>
              ))}
              {!mistakes.length ? (
                <tr>
                  <td colSpan={6} className="muted">
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
