import type { Metadata, Viewport } from "next";
import { Orbitron, Exo_2, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "@/components/Providers";
import { BackgroundSpace } from "@/components/BackgroundSpace";

// Tipografías Futuristas - OBLIGATORIAS
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Base URL for all metadata
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healify.dev";

// Complete SEO Metadata configuration
export const metadata: Metadata = {
  title: {
    default: "Healify - AI-Powered Test Self-Healing Platform",
    template: "%s | Healify",
  },
  description: 
    "Automatically heal your failing E2E tests with AI. Healify detects broken selectors, suggests fixes with high confidence scores, and opens PRs automatically.",
  keywords: ["Healify", "Test Automation", "Self-Healing Tests", "AI Testing", "E2E Testing"],
  authors: [{ name: "Healify Team", url: baseUrl }],
  creator: "Healify",
  publisher: "Healify",
  icons: {
    icon: [
      { url: "/healify-logo.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/healify-logo.svg", sizes: "180x180", type: "image/svg+xml" },
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Healify",
    title: "Healify - Tests That Heal Themselves",
    description: "AI-powered test self-healing platform.",
    images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@healify_dev",
    title: "Healify - Tests That Heal Themselves",
    description: "AI-powered test self-healing platform.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: baseUrl },
  category: "Developer Tools",
  applicationName: "Healify",
};

// Viewport configuration - DARK ONLY
export const   viewport: Viewport = {
  themeColor: "#0A0E1A",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${orbitron.variable} ${exo2.variable} ${jetbrainsMono.variable} font-mono antialiased bg-[#0A0E1A] text-[#E8F0FF]`}
      >
        <BackgroundSpace />
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" theme="dark" />
        </Providers>
      </body>
    </html>
  );
}