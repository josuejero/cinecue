import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { PwaProvider } from "@/shared/ui/pwa-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "CineCue",
    template: "%s | CineCue",
  },
  description: "Track the local theatrical life of the movies you care about.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CineCue",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a1a14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}
    >
      {/* Browser extensions like Grammarly mutate <body> attributes after hydration, so skip the diff */}
      <body
        className="min-h-full bg-[color:var(--paper)] text-[color:var(--foreground)]"
        suppressHydrationWarning={true}
      >
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
