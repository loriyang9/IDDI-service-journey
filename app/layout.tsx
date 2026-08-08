import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "防災避難服務流程分析",
  description:
    "從備災、緊急應變、避難到中長期復原等階段中的七個核心場景，查看不同族群及服務提供者需求，以及關鍵應用情境的設計挑戰與技術解題重點。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
