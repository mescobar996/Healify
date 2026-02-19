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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, ShieldAlert, Zap } from 'lucide-react'
import { AnalyzedSelector } from '@/lib/selector-analyzer'

interface SelectorDashboardProps {
    projectId: string
}

export function SelectorDashboard({ projectId }: SelectorDashboardProps) {
    const [selectors, setSelectors] = useState<AnalyzedSelector[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchSelectors() {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/selectors?projectId=${projectId}`)
                const data = await res.json()
                setSelectors(data)
            } catch (error) {
                console.error('Error fetching selectors:', error)
            } finally {
                setIsLoading(false)
            }
        }

        if (projectId) {
            fetchSelectors()
        }
    }, [projectId])

    const getScoreColor = (score: number) => {
        if (score >= 0.8) return 'text-emerald-500'
        if (score >= 0.5) return 'text-amber-500'
        return 'text-red-500'
    }

    const getScoreBadge = (score: number) => {
        if (score >= 0.8) return <Badge className="bg-emerald-500 hover:bg-emerald-600">Robust</Badge>
        if (score >= 0.5) return <Badge className="bg-amber-500 hover:bg-amber-600">Moderate</Badge>
        return <Badge variant="destructive">Fragile</Badge>
    }

    if (isLoading) {
        return <div className="text-center py-8">Analyzing selectors...</div>
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Selector Analysis Engine</CardTitle>
                        <CardDescription>
                            Predictive robustness scoring for your test selectors
                        </CardDescription>
                    </div>
                    <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Robust</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">
                                {selectors.filter(s => s.score >= 0.8).length}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-500/10">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Moderate</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-600">
                                {selectors.filter(s => s.score >= 0.5 && s.score < 0.8).length}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-red-50 border border-red-100 dark:bg-red-500/10">
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldAlert className="h-4 w-4 text-red-600" />
                                <span className="text-xs font-medium text-red-800 dark:text-red-300">Fragile</span>
                            </div>
                            <p className="text-2xl font-bold text-red-600">
                                {selectors.filter(s => s.score < 0.5).length}
                            </p>
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Selector</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Robustness Score</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectors.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                        {item.selector}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] uppercase">
                                            {item.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Progress value={item.score * 100} className="h-1.5 w-24" />
                                            <span className={`text-sm font-bold ${getScoreColor(item.score)}`}>
                                                {Math.round(item.score * 100)}%
                                            </span>
                                        </div>
                                        {item.recommendation && (
                                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                                                {item.recommendation}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {getScoreBadge(item.score)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
