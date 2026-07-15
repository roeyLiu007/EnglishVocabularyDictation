"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export function TeacherLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "教师登录失败");
      window.dispatchEvent(new Event("teacher-session-changed"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "教师登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel teacher-login-card">
      <LockKeyhole size={34} />
      <h1>教师权限</h1>
      <p className="muted">输入教师管理密码后，可创建听写、管理任务以及维护词库和错词本。</p>
      <form className="form" onSubmit={login}>
        <label>教师管理密码<input autoComplete="current-password" autoFocus required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button disabled={loading} type="submit"><LockKeyhole size={18} /> {loading ? "登录中..." : "进入教师权限"}</button>
      </form>
      {message ? <p className="wrong">{message}</p> : null}
    </section>
  );
}
