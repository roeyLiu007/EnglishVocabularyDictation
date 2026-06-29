import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remote Dictation",
  description: "Room-based English dictation practice"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
