import { AppNav } from "@/components/app-nav";
import { CreateRoom } from "@/components/create-room";

export default function CreatePage() {
  return (
    <main className="shell">
      <AppNav />
      <h1>创建听写</h1>
      <p className="muted">设置本次题数和错词比例，生成链接发给孩子即可开始。</p>
      <CreateRoom />
    </main>
  );
}
