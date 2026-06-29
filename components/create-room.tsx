"use client";

import { useState } from "react";
import { Copy, Play } from "lucide-react";
import type { DictationRoom } from "@/lib/types";

type CreatedRoom = {
  room: DictationRoom;
  parentUrl: string;
  childUrl: string;
};

export function CreateRoom() {
  const [totalCount, setTotalCount] = useState(20);
  const [mistakeRatio, setMistakeRatio] = useState(30);
  const [created, setCreated] = useState<CreatedRoom | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCount, mistakeRatio })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "创建失败");
      setCreated(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("链接已复制");
  }

  return (
    <div className="grid cols-2">
      <section className="panel">
        <div className="form">
          <label>
            本次听写数量
            <input min={1} max={100} type="number" value={totalCount} onChange={(event) => setTotalCount(Number(event.target.value))} />
          </label>
          <label>
            易错词混入比例：{mistakeRatio}%
            <input
              min={0}
              max={80}
              step={5}
              type="range"
              value={mistakeRatio}
              onChange={(event) => setMistakeRatio(Number(event.target.value))}
            />
          </label>
          <p className="muted">题型会在“听英文 / 看英文 / 看中文”之间混合随机。孩子全部完成后才会看到答案。</p>
          <button disabled={loading} onClick={create} type="button">
            <Play size={18} /> {loading ? "创建中..." : "创建听写房间"}
          </button>
          {message ? <p className="muted">{message}</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>房间信息</h2>
        {created ? (
          <div className="form">
            <div>
              <span className="muted">房间码</span>
              <div className="prompt" style={{ fontSize: 48 }}>
                {created.room.id}
              </div>
            </div>
            <label>
              孩子答题链接
              <input readOnly value={created.childUrl} />
            </label>
            <button className="secondary" onClick={() => copy(created.childUrl)} type="button">
              <Copy size={18} /> 复制孩子链接
            </button>
            <label>
              家长监控链接
              <input readOnly value={created.parentUrl} />
            </label>
            <a className="button" href={created.parentUrl}>
              进入家长监控
            </a>
          </div>
        ) : (
          <p className="muted">创建后会在这里生成孩子链接和家长监控链接。</p>
        )}
      </section>
    </div>
  );
}
