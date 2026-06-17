import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

// All three font variable class names, joined — referenced in the no-flash script below.
const fontClasses = `${geist.variable} ${geistMono.variable} ${newsreader.variable}`;

export const metadata: Metadata = {
  title: "Provenance",
  description: "Social media command center for Pelican Club.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontClasses} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash script: reads localStorage before paint and applies theme class
            to <html> WITHOUT destroying the font variable classes.
            Adds only "dark" or "light" to the existing className. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var t=localStorage.getItem('theme');
  var el=document.documentElement;
  var cls=el.className;
  // Remove any prior theme tokens, keep font vars + utility classes
  cls=cls.replace(/\\b(dark|light)\\b/g,'').trim();
  el.className=cls+' '+(t==='light'?'light':'dark');
}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--bg)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
      >
        <ThemeProvider fontClasses={fontClasses}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
