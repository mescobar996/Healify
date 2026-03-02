'use server'

import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { createCheckoutSession, PLANS } from '@/lib/stripe'

// ============================================
// CHECKOUT ACTIONS
// ============================================

export async function createCheckout(planId: keyof typeof PLANS) {
  // 1. Check authentication
  const user = await getSessionUser()
  
  if (!user?.email) {
    redirect('/auth/signin')
  }

  const plan = PLANS[planId]
  
  if (!plan) {
    return { error: 'Invalid plan selected' }
  }

  try {
    // 2. Create Stripe checkout session
    const stripeSession = await createCheckoutSession(
      user.id!,
      user.email,
      plan.priceId
    )

    // 3. Redirect to Stripe
    if (stripeSession.url) {
      redirect(stripeSession.url)
    }

    return { error: 'Failed to create checkout session' }
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return { 
      error: error instanceof Error ? error.message : 'Checkout failed' 
    }
  }
}

// ============================================
// GET USER PLAN
// ============================================

export async function getUserPlan() {
  const user = await getSessionUser()
  
  if (!user?.id) {
    return { plan: 'free', isActive: false }
  }

  // In production, fetch from database subscription table
  // For now, return free tier
  return { plan: 'free', isActive: false }
}