import { AppNav } from "@/components/app-nav";
import { MistakeBook } from "@/components/mistake-book";

export default function MistakesPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>错词本</h1>
      <p className="muted">教师记录听写结果后，错词会汇总到这里；支持按听写人、错误类型和复习状态筛选。</p>
      <MistakeBook />
    </main>
  );
}
