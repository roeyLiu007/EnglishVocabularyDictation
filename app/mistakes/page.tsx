import { AppNav } from "@/components/app-nav";
import { MistakeBook } from "@/components/mistake-book";

export default function MistakesPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>错词本</h1>
      <p className="muted">错词会在听写完成时结算，可在这里修改单词内容、逐个移除错词记录，或一键清空全部错词。</p>
      <MistakeBook />
    </main>
  );
}
