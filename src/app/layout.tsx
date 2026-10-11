import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "Kumaran Mess",
    template: "%s | Kumaran Mess",
  },
  description:
    "Order fresh meals and bakes from Kumaran Mess for delivery, cash on delivery available.",
};

// Reads the "theme" cookie (values: "light" | "dark" — never written for
// "system") and sets [data-theme] on <html> before first paint, so there
// is no flash of the wrong theme. Runs synchronously in <head> during
// HTML parsing, per Next.js's own guide for this exact problem
// (node_modules/next/dist/docs/01-app/02-guides/
// preventing-flash-before-hydration.md, "Themes" section) — a cookie
// rather than localStorage so the same inline-script technique keeps
// working without needing to read it on the server (which would opt
// this layout out of static rendering, per that same guide).
const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=m&&decodeURIComponent(m[1]);if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
