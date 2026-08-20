import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Google Docs Clone - Collaborative Editor",
  description: "Real-time collaborative rich-text document editor with CRDT synchronization and modern Google Docs UI.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable} h-full`}>
      <body className="h-full bg-[#f9fbfd] text-[#202124] antialiased flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
