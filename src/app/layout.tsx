import type { Metadata, Viewport } from "next";
import Script from "next/script";
import TelegramMiniAppInit from "@/components/telegram/TelegramMiniAppInit";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "UzHamyon — Aqlli shaxsiy moliya va budjet boshqaruvi",
  description: "UzHamyon — Shaxsiy moliya, xarajatlar va daromadlar boshqaruvi",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
};

export const instant = false;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uz"
      className="h-full antialiased font-sans"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F7F8F5] text-[#171B16] font-sans selection:bg-[#F0F9E9] selection:text-[#163300]">
        <TelegramMiniAppInit />
        {children}
      </body>
    </html>
  );
}
