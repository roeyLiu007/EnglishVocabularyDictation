import { AppNav } from "@/components/app-nav";
import { ParentRoom } from "@/components/parent-room";

export default function ParentRoomPage({
  params,
  searchParams
}: {
  params: { roomId: string };
  searchParams: { token?: string };
}) {
  return (
    <main className="shell">
      <AppNav />
      <h1>家长监控</h1>
      <p className="muted">这里会自动刷新孩子的答题进度；中文释义有同义表达时，可以手动改判。</p>
      <ParentRoom roomId={params.roomId} token={searchParams.token ?? ""} />
    </main>
  );
}
