import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Gate",
  description: "Персональный терминал контроля торгового риска",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#030407] text-neutral-100">{children}</body>
    </html>
  );
}
