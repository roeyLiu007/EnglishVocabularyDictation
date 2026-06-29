import { AppNav } from "@/components/app-nav";
import { LibraryManager } from "@/components/library-manager";

export default function LibraryPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>词库</h1>
      <p className="muted">下载固定模板，填写后上传；确认解析结果后，可保存为本次上传词库或更新到基础词汇表。</p>
      <LibraryManager />
    </main>
  );
}
