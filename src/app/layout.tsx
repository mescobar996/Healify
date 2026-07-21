import type { Metadata, Viewport } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL(baseUrl),
  title: {
    default: "Healify",
    template: "Healify",
  },
  description:
    "Reporter local y gratuito para Playwright y Cypress: cuando un selector se rompe, Healify sugiere el fix en tu propia máquina, sin cuenta ni servidor.",
  keywords: ["Healify", "Test Automation", "Self-Healing Tests", "Playwright", "Cypress", "E2E Testing"],
  authors: [{ name: "Healify Team", url: baseUrl }],
  creator: "Healify",
  publisher: "Healify",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: baseUrl,
    siteName: "Healify",
    title: "Healify - Sanado local de selectores rotos",
    description: "Reporter local y gratuito para Playwright y Cypress. Sin cuenta, sin servidor.",
    images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@healify_dev",
    title: "Healify - Sanado local de selectores rotos",
    description: "Reporter local y gratuito para Playwright y Cypress.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: baseUrl },
  category: "Developer Tools",
  applicationName: "Healify",
};

// Viewport configuration - DARK ONLY + mobile notch support
export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${montserrat.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0A0A0A] text-[#EDEDED]`}
      >
        {children}
      </body>
    </html>
  );
}