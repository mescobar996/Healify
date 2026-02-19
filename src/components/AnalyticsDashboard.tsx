'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { Clock, DollarSign, TrendingUp, Zap } from 'lucide-react'
import { ProjectAnalytics } from '@/lib/analytics-service'

interface AnalyticsDashboardProps {
    projectId: string
}

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
    const [data, setData] = useState<ProjectAnalytics | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchAnalytics() {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/analytics?projectId=${projectId}`)
                const analytics = await res.json()
                setData(analytics)
            } catch (error) {
                console.error('Error fetching analytics:', error)
            } finally {
                setIsLoading(false)
            }
        }

        if (projectId) {
            fetchAnalytics()
        }
    }, [projectId])

    if (isLoading || !data) {
        return <div className="text-center py-8">Loading metrics...</div>
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-sky-50 dark:bg-sky-500/10 border-sky-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-sky-600 font-medium">Time Saved</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-sky-600" />
                            <span className="text-2xl font-bold text-sky-700">{Math.round(data.timeSavedMinutes / 60)}h</span>
                        </div>
                        <p className="text-[10px] text-sky-600/70 mt-1">Estimated developer time</p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-600 font-medium">ROI (USD)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-emerald-600" />
                            <span className="text-2xl font-bold text-emerald-700">${Math.round(data.roiCurrency)}</span>
                        </div>
                        <p className="text-[10px] text-emerald-600/70 mt-1">Cost saved @ $65/hr</p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-50 dark:bg-purple-500/10 border-purple-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-purple-600 font-medium">Reliability</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-purple-600" />
                            <span className="text-2xl font-bold text-purple-700">{data.testReliabilityScore}%</span>
                        </div>
                        <p className="text-[10px] text-purple-600/70 mt-1">Overall test health score</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50 dark:bg-amber-500/10 border-amber-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-amber-600 font-medium">AI Accuracy</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-600" />
                            <span className="text-2xl font-bold text-amber-700">{data.aiAccuracyScore}%</span>
                        </div>
                        <p className="text-[10px] text-amber-600/70 mt-1">Healing precision score</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-100">
                    <CardHeader>
                        <CardTitle className="text-lg">Healing Activity Trend</CardTitle>
                        <CardDescription>Daily auto-fixed tests</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.healingTrend}>
                                    <defs>
                                        <linearGradient id="colorHealing" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#0ea5e9"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorHealing)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-100">
                    <CardHeader>
                        <CardTitle className="text-lg">AI Healing Accuracy</CardTitle>
                        <CardDescription>Precision % over last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.aiAccuracyTrend}>
                                    <defs>
                                        <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                    />
                                    <YAxis hide domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="accuracy"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorAccuracy)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
