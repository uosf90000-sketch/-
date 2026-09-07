import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "بيتي — من المخطط إلى بيت تفاعلي",
  description: "تصميم داخلي وتأثيث ثلاثي الأبعاد من مخططك.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
