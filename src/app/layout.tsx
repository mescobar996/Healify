import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healify - AI-Powered Test Self-Healing Platform",
  description: "Automatically heal your failing tests with AI. Healify detects broken selectors and suggests fixes with high confidence scores.",
  keywords: ["Healify", "Test Automation", "Self-Healing Tests", "AI Testing", "E2E Testing", "Playwright", "Cypress", "Test Maintenance"],
  authors: [{ name: "Healify Team" }],
  icons: {
    icon: "/healify-logo.png",
  },
  openGraph: {
    title: "Healify - Tests That Heal Themselves",
    description: "AI-powered test self-healing platform for modern development teams",
    url: "https://healify.dev",
    siteName: "Healify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Healify - Tests That Heal Themselves",
    description: "AI-powered test self-healing platform for modern development teams",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
