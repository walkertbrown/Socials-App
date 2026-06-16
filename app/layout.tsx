import type { Metadata } from "next";
import { Outfit, Crimson_Pro } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Provenance",
  description: "Social media command center for Pelican Club.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#100c09",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${crimsonPro.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash script: reads localStorage before paint and applies class to <html>.
            Default is dark — matches the :root token block in globals.css. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.className=(t==='light'?'light':'dark')+' h-full antialiased ${outfit.variable} ${crimsonPro.variable}';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
