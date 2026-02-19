'use client'

import { useState } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { PLANS } from '@/lib/stripe'
import { cn } from '@/lib/utils'

export default function PricingPage() {
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

    const handleSubscribe = async (priceId: string, planId: string) => {
        setLoadingPlan(planId)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId }),
            })
            const { url } = await res.json()
            if (url) {
                window.location.href = url
            }
        } catch (error) {
            console.error('Checkout error:', error)
        } finally {
            setLoadingPlan(null)
        }
    }

    return (
        <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Choose the plan that's right for your team and start healing your tests.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {Object.values(PLANS).map((plan) => (
                        <Card
                            key={plan.id}
                            className={cn(
                                "relative flex flex-col",
                                plan.id === 'pro' && "border-primary shadow-lg scale-105 z-10"
                            )}
                        >
                            {plan.id === 'pro' && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" /> Popular
                                    </span>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                <CardDescription>Perfect for {plan.id === 'starter' ? 'small teams' : plan.id === 'pro' ? 'growing teams' : 'large scale organizations'}.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="mb-6">
                                    <span className="text-4xl font-bold">${plan.price}</span>
                                    <span className="text-muted-foreground">/mo</span>
                                </div>
                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-emerald-500" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full"
                                    variant={plan.id === 'pro' ? 'default' : 'outline'}
                                    disabled={loadingPlan === plan.id}
                                    onClick={() => handleSubscribe(plan.priceId!, plan.id)}
                                >
                                    {loadingPlan === plan.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Get Started
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <p className="text-muted-foreground">
                        Need something else? <a href="#" className="text-primary hover:underline font-medium">Contact our sales team</a> for a custom enterprise plan.
                    </p>
                </div>
            </div>
        </div>
    )
}
