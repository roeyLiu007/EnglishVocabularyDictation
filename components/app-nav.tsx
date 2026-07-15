"use client";

import Link from "next/link";
import { ClipboardList, Home, ListChecks, LockKeyhole, MonitorCheck, Upload } from "lucide-react";
import { useEffect, useState } from "react";

export function AppNav() {
  const [teacher, setTeacher] = useState(false);
  useEffect(() => {
    const refresh = () => fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setTeacher(Boolean(data.authenticated)))
      .catch(() => setTeacher(false));
    void refresh();
    window.addEventListener("teacher-session-changed", refresh);
    return () => window.removeEventListener("teacher-session-changed", refresh);
  }, []);
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        浩辰听写屋
      </Link>
      <nav className="nav" aria-label="主导航">
        <Link href="/"><Home size={17} /> 首页</Link>
        <Link href="/library">
          <Upload size={17} /> 词库
        </Link>
        {teacher ? <Link href="/create">
          <ClipboardList size={17} /> 创建听写
        </Link> : null}
        {teacher ? <Link href="/tasks">
          <MonitorCheck size={17} /> 听写任务
        </Link> : null}
        <Link href="/mistakes">
          <ListChecks size={17} /> 错词本
        </Link>
        {!teacher ? <Link href="/teacher"><LockKeyhole size={17} /> 教师入口</Link> : null}
        {teacher ? <Link href="/teacher"><LockKeyhole size={17} /> 教师工作台</Link> : null}
      </nav>
    </header>
  );
}
