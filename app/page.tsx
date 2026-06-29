import Link from "next/link";
import { BookOpen, ClipboardList, TabletSmartphone } from "lucide-react";
import { AppNav } from "@/components/app-nav";

export default function HomePage() {
  return (
    <main className="shell">
      <AppNav />
      <section className="hero">
        <div>
          <h1>远程英语听写房间</h1>
          <p>
            上传学校单词表，随机生成混合题型，孩子用平板答题。听写完成后再展示答案，错词会自动进入后续练习。
          </p>
        </div>
        <div className="grid cols-3">
          <div className="panel stat">
            <strong>3</strong>
            <span>听英文、看英文、看中文三种题型混合随机</span>
          </div>
          <div className="panel stat">
            <strong>30%</strong>
            <span>可设置错词混入比例，薄弱词更容易再次出现</span>
          </div>
          <div className="panel stat">
            <strong>1</strong>
            <span>一个链接即可让孩子异地进入听写</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link className="button" href="/library">
            <BookOpen size={18} /> 上传单词表
          </Link>
          <Link className="button secondary" href="/create">
            <ClipboardList size={18} /> 创建听写
          </Link>
          <Link className="button secondary" href="/mistakes">
            <TabletSmartphone size={18} /> 查看错词
          </Link>
        </div>
      </section>
    </main>
  );
}
