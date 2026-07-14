import { AppNav } from "@/components/app-nav";
import { TaskManager } from "@/components/task-manager";

export default function TasksPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>听写任务</h1>
      <TaskManager />
    </main>
  );
}
