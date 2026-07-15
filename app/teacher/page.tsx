import Link from "next/link";
import { BookOpen, ClipboardList, ListChecks, MonitorCheck } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { TeacherLogin } from "@/components/teacher-login";
import { hasTeacherPageSession } from "@/lib/server/page-auth";

export default function TeacherPage() {
  const authenticated = hasTeacherPageSession();
  return (
    <main className="shell">
      <AppNav />
      {authenticated ? (
        <section className="panel teacher-dashboard">
          <span className="eyebrow">Teacher Console</span>
          <h1>教师工作台</h1>
          <p className="muted">创建听写、查看任务，并维护学生使用的词库与错词本。</p>
          <div className="grid cols-2 teacher-entry-grid">
            <Link className="button" href="/create"><ClipboardList size={18} /> 创建听写</Link>
            <Link className="button secondary" href="/tasks"><MonitorCheck size={18} /> 听写任务</Link>
            <Link className="button secondary" href="/library"><BookOpen size={18} /> 管理词库</Link>
            <Link className="button secondary" href="/mistakes"><ListChecks size={18} /> 管理错词本</Link>
          </div>
        </section>
      ) : <TeacherLogin />}
    </main>
  );
}
