import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/ServiceWorker";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Chinese for devices without PingFang (e.g. Windows). Google serves it in
// small unicode-range slices, so only the characters in use get downloaded,
// and only where no earlier font in the stack covers them.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  preload: false,
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nestery",
  description: "A calm, personal home for your tasks and notes.",
  // Added to an iPhone's home screen, it opens full screen as "Nestery".
  // The default status bar keeps the page below it, so nothing needs to
  // make room for the notch.
  appleWebApp: { capable: true, title: "Nestery", statusBarStyle: "default" },
};

// The window's title bar (installed app) and the phone's status bar follow
// the page background of each theme
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0b" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The font variables go on <html>: Tailwind sets the page font there, so
    // on <body> they'd be undefined where it's read
    <html lang="en" className={`${figtree.variable} ${notoSansSC.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
