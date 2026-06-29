import { ChildRoom } from "@/components/child-room";

export default function ChildRoomPage({
  params,
  searchParams
}: {
  params: { roomId: string };
  searchParams: { token?: string };
}) {
  return (
    <main className="shell">
      <ChildRoom roomId={params.roomId} token={searchParams.token ?? ""} />
    </main>
  );
}
