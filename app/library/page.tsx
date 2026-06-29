import { AppNav } from "@/components/app-nav";
import { LibraryManager } from "@/components/library-manager";

export default function LibraryPage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>词库</h1>
      <p className="muted">上传 Word / PDF 后先确认解析结果，再保存到后续听写使用的词库。</p>
      <LibraryManager />
    </main>
  );
}
