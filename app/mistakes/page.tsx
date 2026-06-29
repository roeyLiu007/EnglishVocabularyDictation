import { AppNav } from "@/components/app-nav";
import { MistakeBook } from "@/components/mistake-book";

export default function MistakesPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>错词本</h1>
      <p className="muted">错词会在听写完成时结算，并在下次创建房间时按权重混入。</p>
      <MistakeBook />
    </main>
  );
}
