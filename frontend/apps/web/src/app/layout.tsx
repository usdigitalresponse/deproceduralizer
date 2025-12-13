import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Deproceduralizer",
    template: "%s | Deproceduralizer",
  },
  description: "Regulatory analysis tool for identifying compliance issues, procedural complexity, and technical review requirements in government regulations.",
  keywords: ["regulatory analysis", "compliance", "government regulations", "red flags", "procedural complexity"],
  authors: [{ name: "Recoding America Fund" }],
  openGraph: {
    title: "Deproceduralizer",
    description: "Regulatory analysis tool for identifying compliance issues and procedural complexity in government regulations.",
    type: "website",
    locale: "en_US",
    siteName: "Deproceduralizer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deproceduralizer",
    description: "Regulatory analysis tool for identifying compliance issues and procedural complexity in government regulations.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
