import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Precios — Healify',
  description: 'Planes simples para equipos de todos los tamaños. Empezá gratis, sin tarjeta de crédito.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
