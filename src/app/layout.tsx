import type { Metadata, Viewport } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "@/components/Providers";
import { BackgroundSpace } from "@/components/BackgroundSpace";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Base URL for all metadata (producción: healify-sigma.vercel.app)
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://healify-sigma.vercel.app";

// Complete SEO Metadata configuration
export const metadata: Metadata = {
  title: {
    default: "Healify",
    template: "Healify",
  },
  description: 
    "Automatically heal your failing E2E tests with AI. Healify detects broken selectors, suggests fixes with high confidence scores, and opens PRs automatically.",
  keywords: ["Healify", "Test Automation", "Self-Healing Tests", "AI Testing", "E2E Testing"],
  authors: [{ name: "Healify Team", url: baseUrl }],
  creator: "Healify",
  publisher: "Healify",
  icons: {
    icon: [
      { url: "/favicon.ico",    sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Healify",
    title: "Healify",
    description: "AI-powered test self-healing platform.",
    images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@healify_dev",
    title: "Healify",
    description: "AI-powered test self-healing platform.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: baseUrl },
  category: "Developer Tools",
  applicationName: "Healify",
};

// Viewport configuration - DARK ONLY
export const viewport: Viewport = {
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
        className={`${montserrat.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0A0E1A] text-[#E8F0FF]`}
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