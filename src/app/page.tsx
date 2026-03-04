import type { Metadata } from 'next'
import LandingPage from '@/components/LandingPage'

export const metadata: Metadata = {
  title: 'Healify - Tests That Heal Themselves',
  description:
    'AI-powered self-healing test infrastructure. Stop fixing broken selectors manually. Healify detects, fixes, and opens PRs automatically. 98% accuracy.',
  openGraph: {
    title: 'Healify - Tests That Heal Themselves',
    description:
      'AI-powered self-healing test infrastructure. Stop fixing broken selectors manually.',
    url: 'https://healify-sigma.vercel.app',
    siteName: 'Healify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Healify - Tests That Heal Themselves',
    description: 'AI-powered self-healing test infrastructure.',
  },
}

export default function HomePage() {
  return <LandingPage />
}
