import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

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
        </ThemeProvider>
      </body>
    </html>
  );
}
