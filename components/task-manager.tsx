"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Copy, ExternalLink, LockKeyhole, LogOut, RefreshCcw } from "lucide-react";
import { readApiJson } from "@/lib/client-api";
import type { RoomTaskSummary } from "@/lib/types";
import { stageLabel } from "@/lib/vocabulary";

type SessionPayload = {
  configured?: boolean;
  authenticated?: boolean;
  error?: string;
};

type TasksPayload = {
  tasks?: RoomTaskSummary[];
  error?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function sourceLabel(task: RoomTaskSummary) {
  if (task.wordSource === "stage") return task.stage ? stageLabel(task.stage) : "阶段词库";
  if (task.wordSource === "latestUpload") return "最近上传";
  return "全部词库";
}

function statusLabel(status: RoomTaskSummary["status"]) {
  if (status === "recorded") return "已记错题";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  return "进行中";
}

function deadlineLabel(task: RoomTaskSummary) {
  if (task.expiresAt) return `截止 ${formatDate(task.expiresAt)}`;
  if (task.timeLimitMinutes) return `未开始，学生打开后 ${task.timeLimitMinutes} 分钟截止`;
  return "";
}

export function TaskManager() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [tasks, setTasks] = useState<RoomTaskSummary[]>([]);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/rooms", { cache: "no-store" });
      const data = await readApiJson<TasksPayload>(response, "加载听写任务失败");
      if (response.status === 401) {
        setAuthenticated(false);
        setMessage(data.error ?? "登录已过期，请重新登录");
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "加载听写任务失败");
      setTasks(data.tasks ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载听写任务失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => readApiJson<SessionPayload>(response, "检查登录状态失败"))
      .then((data) => {
        if (!active) return;
        setConfigured(Boolean(data.configured));
        setAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) void loadTasks();
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "检查登录状态失败");
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setInterval(() => void loadTasks(), 10_000);
    return () => window.clearInterval(timer);
  }, [authenticated, loadTasks]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (tab === "current" ? task.status === "active" : task.status !== "active")),
    [tab, tasks]
  );
  const activeCount = tasks.filter((task) => task.status === "active").length;
  const completedCount = tasks.filter((task) => task.status === "completed" || task.status === "recorded").length;
  const closedCount = tasks.filter((task) => task.status === "closed").length;
  const answeredCount = tasks.reduce((sum, task) => sum + task.answeredCount, 0);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await readApiJson<SessionPayload>(response, "登录失败");
      if (!response.ok) throw new Error(data.error ?? "登录失败");
      setAuthenticated(true);
      setPassword("");
      await loadTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setTasks([]);
    setMessage("");
  }

  async function copyLink(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label}已复制`);
  }

  async function closeTask(task: RoomTaskSummary) {
    if (!window.confirm(`确定关闭听写 ${task.id}？学生将不能继续答题，已提交结果会保留。`)) return;
    setClosingId(task.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/rooms/${task.id}/close`, { method: "POST" });
      const data = await readApiJson<{ error?: string }>(response, "关闭听写任务失败");
      if (!response.ok) throw new Error(data.error ?? "关闭听写任务失败");
      setMessage(`听写 ${task.id} 已关闭`);
      await loadTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "关闭听写任务失败");
    } finally {
      setClosingId("");
    }
  }

  if (sessionLoading) return <section className="panel">正在检查教师登录状态...</section>;

  if (!configured) {
    return (
      <section className="panel task-login">
        <h2>教师管理尚未启用</h2>
        <p className="muted">请先在部署环境中配置 DICTATION_ADMIN_PASSWORD，然后重新部署。</p>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="panel task-login">
        <LockKeyhole size={30} aria-hidden="true" />
        <h2>教师登录</h2>
        <form className="form" onSubmit={login}>
          <label>
            管理密码
            <input
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={loading} type="submit">
            <LockKeyhole size={18} /> {loading ? "登录中..." : "进入任务管理"}
          </button>
          {message ? <p className="wrong">{message}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <div className="task-manager">
      <div className="task-toolbar">
        <div className="segmented-control" aria-label="任务范围">
          <button className={tab === "current" ? "active" : ""} onClick={() => setTab("current")} type="button">
            当前任务 {activeCount}
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")} type="button">
            历史任务 {completedCount + closedCount}
          </button>
        </div>
        <div className="task-toolbar-actions">
          <button className="secondary" disabled={loading} onClick={() => void loadTasks()} title="刷新任务" type="button">
            <RefreshCcw size={18} /> 刷新
          </button>
          <button className="secondary" onClick={() => void logout()} title="退出教师管理" type="button">
            <LogOut size={18} /> 退出
          </button>
        </div>
      </div>

      <section className="task-metrics" aria-label="任务统计">
        <div><strong>{activeCount}</strong><span>进行中</span></div>
        <div><strong>{completedCount}</strong><span>已完成</span></div>
        <div><strong>{closedCount}</strong><span>已关闭</span></div>
        <div><strong>{answeredCount}</strong><span>累计答题</span></div>
      </section>

      {message ? <p className="task-message">{message}</p> : null}

      <section className="panel task-table-panel">
        <div className="table-scroll">
          <table className="task-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>创建时间</th>
                <th>任务</th>
                <th>进度</th>
                <th>结果</th>
                <th>最近提交</th>
                <th>链接与操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((task) => (
                <tr key={task.id}>
                  <td><span className={`status-badge ${task.status}`}>{statusLabel(task.status)}</span></td>
                  <td>{formatDate(task.createdAt)}</td>
                  <td>
                    <strong>{task.id}</strong>
                    <div className="table-subtext">{task.dictationPerson || "未标注"} · {sourceLabel(task)} · {task.totalCount} 题</div>
                    {deadlineLabel(task) ? <div className="table-subtext">{deadlineLabel(task)}</div> : null}
                  </td>
                  <td>
                    <div className="task-progress-label"><span>{task.answeredCount}/{task.totalCount}</span><span>{Math.round((task.answeredCount / Math.max(1, task.totalCount)) * 100)}%</span></div>
                    <progress max={Math.max(1, task.totalCount)} value={task.answeredCount} />
                  </td>
                  <td>
                    <span className="ok">对 {task.correctCount}</span>
                    <span className="wrong">错 {task.wrongCount}</span>
                    {task.pendingCount ? <span className="pending">待确认 {task.pendingCount}</span> : null}
                  </td>
                  <td>{formatDate(task.lastSubmittedAt)}</td>
                  <td>
                    <div className="task-actions">
                      <button className="secondary" onClick={() => void copyLink(task.childUrl, "学生链接")} title="复制学生链接" type="button">
                        <Copy size={17} /> 学生链接
                      </button>
                      <a className="button secondary" href={task.parentUrl} rel="noreferrer" target="_blank" title="打开听写结果">
                        <ExternalLink size={17} /> 查看结果
                      </a>
                      {task.status === "active" ? (
                        <button className="danger" disabled={closingId === task.id} onClick={() => void closeTask(task)} type="button">
                          <Ban size={17} /> {closingId === task.id ? "关闭中..." : "关闭"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleTasks.length ? (
                <tr><td className="task-empty" colSpan={7}>{tab === "current" ? "暂无进行中的听写任务" : "暂无历史听写任务"}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
