import type { Metadata } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthGuard } from "@/components/auth/AuthGuard";

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "../fonts/InterVariable.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/InterVariable-Italic.woff2", style: "italic", weight: "100 900" },
  ],
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  display: "swap",
  src: [
    { path: "../fonts/JetBrainsMonoVariable.woff2", style: "normal", weight: "100 800" },
    { path: "../fonts/JetBrainsMonoVariable-Italic.woff2", style: "italic", weight: "100 800" },
  ],
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
        <NuqsAdapter>
          <Header />
          <main className="flex-1">
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>
          <Footer />
        </NuqsAdapter>
        <Toaster position="bottom-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
