import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono, Noto_Sans_SC, Noto_Sans_TC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
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

// The same for Traditional Chinese, used when the page is in zh-TW
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // From the user's saved language (cookie) or the browser's (src/i18n/request.ts)
  const locale = await getLocale();
  return (
    // The font variables go on <html>: Tailwind sets the page font there, so
    // on <body> they'd be undefined where it's read. `lang` also picks the
    // Chinese fonts (Simplified or Traditional) in globals.css.
    <html
      lang={locale}
      className={`${figtree.variable} ${notoSansSC.variable} ${notoSansTC.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/* Passes this language's messages to client components */}
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
            <ServiceWorker />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
