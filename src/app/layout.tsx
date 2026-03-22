import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/pwa-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineCue",
  description: "Follow movies and track local theatre availability changes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CineCue",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions like Grammarly mutate <body> attributes after hydration, so skip the diff */}
      <body
        className="min-h-full bg-slate-50 text-slate-900"
        suppressHydrationWarning={true}
      >
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
