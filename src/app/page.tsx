import type { Metadata } from 'next'
import LandingPage from '@/components/LandingPage'

export const metadata: Metadata = {
  title: 'Healify - Tests que se curan solos',
  description:
    'Infraestructura de self-healing para tests con IA. Dejá de reparar selectores manualmente. Healify detecta, corrige y abre PRs automáticamente. 98% de precisión.',
  openGraph: {
    title: 'Healify - Tests que se curan solos',
    description:
      'Infraestructura de self-healing para tests con IA. Dejá de reparar selectores manualmente.',
    url: 'https://healify-sigma.vercel.app',
    siteName: 'Healify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Healify - Tests que se curan solos',
    description: 'Infraestructura de self-healing para tests con IA.',
  },
}

export default function HomePage() {
  return <LandingPage />
}
