import { AppNav } from "@/components/app-nav";
import { TaskManager } from "@/components/task-manager";
import { redirect } from "next/navigation";
import { hasTeacherPageSession } from "@/lib/server/page-auth";

export default function TasksPage() {
  if (!hasTeacherPageSession()) redirect("/library");
  return (
    <main className="shell">
      <AppNav />
      <h1>听写任务</h1>
      <TaskManager />
    </main>
  );
}
