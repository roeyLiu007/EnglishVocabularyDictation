import Link from "next/link";
import { ClipboardList, Home, ListChecks, MonitorCheck, Upload } from "lucide-react";

export function AppNav() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        浩辰听写屋
      </Link>
      <nav className="nav" aria-label="主导航">
        <Link href="/">
          <Home size={17} /> 首页
        </Link>
        <Link href="/library">
          <Upload size={17} /> 词库
        </Link>
        <Link href="/create">
          <ClipboardList size={17} /> 创建听写
        </Link>
        <Link href="/tasks">
          <MonitorCheck size={17} /> 听写任务
        </Link>
        <Link href="/mistakes">
          <ListChecks size={17} /> 错词本
        </Link>
      </nav>
    </header>
  );
}
