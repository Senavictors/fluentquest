import type { Metadata } from "next";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/400-italic.css";
import "./globals.css";
import { App } from "@/client/App";
export const metadata: Metadata = {
  title: "FluentQuest — inglês em prática",
  description: "Seu espaço pessoal para estudar, falar e revisar inglês.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <App />
        {children}
      </body>
    </html>
  );
}
