import Link from "next/link";
import { BookOpen, GraduationCap, ListChecks } from "lucide-react";
import { AppNav } from "@/components/app-nav";

export default function StudentHomePage() {
  return (
    <main className="shell">
      <AppNav />
      <section className="hero anime-hero">
        <div className="hero-copy">
          <span className="eyebrow">English Quest Room</span>
          <h1>浩辰听写屋</h1>
          <p>学生可以浏览词库、播放标准发音、查看错词与复习安排；使用教师分享的链接进入听写。</p>
        </div>
        <div className="grid cols-3">
          <div className="panel stat"><strong>词库</strong><span>按阶段搜索和浏览英语单词</span></div>
          <div className="panel stat"><strong>发音</strong><span>使用百度云生成与 Supabase 缓存语音</span></div>
          <div className="panel stat"><strong>复习</strong><span>按听写人查看错词和复习状态</span></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link className="button" href="/library"><BookOpen size={18} /> 查看词库</Link>
          <Link className="button secondary" href="/mistakes"><ListChecks size={18} /> 查看错词本</Link>
          <Link className="button secondary" href="/teacher"><GraduationCap size={18} /> 教师入口</Link>
        </div>
      </section>
    </main>
  );
}
