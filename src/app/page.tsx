'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  FolderGit2,
  GitBranch,
  Wand2,
  Loader2,
  Plus,
  Play,
  RefreshCw,
  Sparkles,
  TestTube,
  XCircle,
  LogOut,
  User as UserIcon,
  Github,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSession, signIn, signOut } from 'next-auth/react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { SelectorDashboard } from '@/components/SelectorDashboard'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { NotificationBell } from '@/components/NotificationBell'

// Types
interface Project {
  id: string
  name: string
  description: string | null
  repository: string | null
  testRunCount: number
  lastTestRun: {
    status: string
    startedAt: string
    passedTests: number
    totalTests: number
    healedTests: number
  } | null
  createdAt: string
  updatedAt: string
}

interface TestRun {
  id: string
  projectId: string
  projectName: string
  branch: string | null
  status: string
  totalTests: number
  passedTests: number
  failedTests: number
  healedTests: number
  duration: number | null
  startedAt: string
  finishedAt: string | null
  commitMessage: string | null
}

interface HealingEvent {
  id: string
  testName: string
  testFile: string | null
  failedSelector: string
  selectorType: string
  errorMessage: string
  newSelector: string | null
  newSelectorType: string | null
  confidence: number | null
  status: string
  reasoning: string | null
  actionTaken: string | null
  projectName: string
  projectId: string
  testRunId: string
  createdAt: string
  updatedAt: string
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'default',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down'
  trendValue?: string
  color?: 'default' | 'success' | 'warning' | 'info'
}) {
  const colorClasses = {
    default: 'bg-muted/50 border-slate-200/50',
    success: 'bg-emerald-500/10 border-emerald-200/50',
    warning: 'bg-amber-500/10 border-amber-200/50',
    info: 'bg-sky-500/10 border-sky-200/50',
  }

  const iconColorClasses = {
    default: 'text-muted-foreground',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-sky-600',
  }

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 h-full min-h-[160px] flex flex-col justify-between border-2",
        colorClasses[color]
      )}>
        <div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <div className={cn('rounded-lg p-2 bg-white/50 backdrop-blur shadow-sm')}>
              <Icon className={cn('h-4 w-4', iconColorClasses[color])} />
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </CardContent>
        </div>

        {trend && trendValue && (
          <CardContent className="pt-0 pb-4">
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit',
                trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              )}
            >
              {trend === 'up' ? (
                <ArrowRight className="h-3 w-3 rotate-[-45deg]" />
              ) : (
                <ArrowRight className="h-3 w-3 rotate-45" />
              )}
              {trendValue}
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
  > = {
    PASSED: { label: 'Passed', variant: 'default', className: 'bg-emerald-500 hover:bg-emerald-600' },
    FAILED: { label: 'Failed', variant: 'destructive' },
    HEALED: { label: 'Healed', variant: 'default', className: 'bg-sky-500 hover:bg-sky-600' },
    PENDING: { label: 'Pending', variant: 'secondary' },
    RUNNING: { label: 'Running', variant: 'outline', className: 'border-amber-500 text-amber-600 animate-pulse' },
    PARTIAL: { label: 'Partial', variant: 'outline', className: 'border-amber-500 text-amber-600' },
    CANCELLED: { label: 'Cancelled', variant: 'secondary' },
    ANALYZING: { label: 'Analyzing', variant: 'outline', className: 'border-purple-500 text-purple-600' },
    HEALED_AUTO: { label: 'Auto-Healed', variant: 'default', className: 'bg-sky-500 hover:bg-sky-600' },
    HEALED_MANUAL: { label: 'Manual Fix', variant: 'default', className: 'bg-teal-500 hover:bg-teal-600' },
    BUG_DETECTED: { label: 'Bug', variant: 'destructive' },
    REMOVED_LEGIT: { label: 'Removed', variant: 'secondary' },
    NEEDS_REVIEW: { label: 'Review', variant: 'outline', className: 'border-amber-500 text-amber-600' },
    IGNORED: { label: 'Ignored', variant: 'secondary' },
  }

  const config = statusConfig[status] || { label: status, variant: 'outline' }

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// Project Card Component
function ProjectCard({
  project,
  onClick,
  onRunTests,
  isRunningTests,
}: {
  project: Project
  onClick: () => void
  onRunTests: (e: React.MouseEvent) => void
  isRunningTests: boolean
}) {
  const lastRunStatus = project.lastTestRun?.status

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {project.description || 'No description'}
            </CardDescription>
          </div>
          {lastRunStatus && <StatusBadge status={lastRunStatus} />}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {project.repository && (
            <div className="flex items-center gap-1">
              <FolderGit2 className="h-4 w-4" />
              <span className="truncate max-w-[150px]">
                {project.repository.replace('https://github.com/', '')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <TestTube className="h-4 w-4" />
            <span>{project.testRunCount} runs</span>
          </div>
        </div>
        {project.lastTestRun && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>
                {project.lastTestRun.passedTests}/{project.lastTestRun.totalTests} tests
              </span>
            </div>
            {project.lastTestRun.healedTests > 0 && (
              <div className="flex items-center gap-1 text-sky-500">
                <Wand2 className="h-4 w-4" />
                <span>{project.lastTestRun.healedTests} healed</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 border-t flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Last run{' '}
          {project.lastTestRun
            ? formatDistanceToNow(new Date(project.lastTestRun.startedAt), {
              addSuffix: true,
            })
            : 'never'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onRunTests}
          disabled={isRunningTests}
        >
          {isRunningTests ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Run Tests
        </Button>
      </CardFooter>
    </Card>
  )
}

// Healing Event Card Component
function HealingEventCard({
  event,
  onAccept,
  onReject,
  onViewDetails,
}: {
  event: HealingEvent
  onAccept: () => void
  onReject: () => void
  onViewDetails: () => void
}) {
  const needsReview = event.status === 'NEEDS_REVIEW' || event.status === 'ANALYZING'

  return (
    <div className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={event.status} />
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
            </span>
          </div>
          <h4 className="font-medium text-sm mb-1 truncate">{event.testName}</h4>
          {event.testFile && (
            <p className="text-xs text-muted-foreground mb-3 font-mono truncate">
              {event.testFile}
            </p>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <code className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded truncate max-w-full">
                {event.failedSelector}
              </code>
            </div>
            {event.newSelector && (
              <>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <code className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded truncate max-w-full">
                    {event.newSelector}
                  </code>
                </div>
              </>
            )}
          </div>
          {event.confidence !== null && (
            <div className="mt-3 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs">
                      <Sparkles className="h-3 w-3 text-purple-500" />
                      <span className="font-medium">{Math.round(event.confidence * 100)}%</span>
                      <span className="text-muted-foreground">confidence</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>AI confidence score for this fix</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
      {needsReview && (
        <div className="mt-4 flex items-center gap-2 pt-3 border-t">
          <Button size="sm" variant="default" onClick={onAccept} className="flex-1">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Accept Fix
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={onViewDetails}>
            View
          </Button>
        </div>
      )}
    </div>
  )
}

// Create Project Dialog Component
function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; description: string; repository: string }) => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [repository, setRepository] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim(), repository: repository.trim() })
    setName('')
    setDescription('')
    setRepository('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to start tracking and healing your tests.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A brief description of your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repository">Repository URL</Label>
              <Input
                id="repository"
                placeholder="https://github.com/owner/repo"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                type="url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Test Run Details Sheet
function TestRunDetailsSheet({
  testRun,
  open,
  onOpenChange,
}: {
  testRun: TestRun | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!testRun) return null

  const duration = testRun.duration
    ? `${Math.floor(testRun.duration / 60000)}m ${Math.floor((testRun.duration % 60000) / 1000)}s`
    : '-'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Test Run Details</SheetTitle>
          <SheetDescription>
            Run from {formatDistanceToNow(new Date(testRun.startedAt), { addSuffix: true })}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <StatusBadge status={testRun.status} />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{testRun.projectName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Branch</p>
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <p className="font-medium">{testRun.branch || '-'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="font-medium">{duration}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="font-medium text-sm">
                {new Date(testRun.startedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Test Results</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{testRun.totalTests}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{testRun.passedTests}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{testRun.failedTests}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="rounded-lg bg-sky-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-sky-600">{testRun.healedTests}</p>
                <p className="text-xs text-muted-foreground">Healed</p>
              </div>
            </div>
          </div>
          {testRun.commitMessage && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Commit Message</p>
                <p className="text-sm">{testRun.commitMessage}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Project Details Sheet
function ProjectDetailsSheet({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!project) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{project.name}</SheetTitle>
          <SheetDescription>{project.description || 'No description provided'}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Repository</p>
              {project.repository ? (
                <a
                  href={project.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <FolderGit2 className="h-3 w-3" />
                  {project.repository.replace('https://github.com/', '')}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Not configured</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Test Runs</p>
              <p className="font-medium">{project.testRunCount}</p>
            </div>
          </div>
          <Separator />
          {project.lastTestRun && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Latest Test Run</p>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={project.lastTestRun.status} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">
                      {project.lastTestRun.passedTests}
                    </p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{project.lastTestRun.totalTests}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-sky-600">
                      {project.lastTestRun.healedTests}
                    </p>
                    <p className="text-xs text-muted-foreground">Healed</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Separator />
          <AnalyticsDashboard projectId={project.id} />
          <Separator />
          <SelectorDashboard projectId={project.id} />
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p>{new Date(project.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Healing Event Details Sheet
function HealingEventDetailsSheet({
  event,
  open,
  onOpenChange,
  onAccept,
  onReject,
}: {
  event: HealingEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: () => void
  onReject: () => void
}) {
  if (!event) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Healing Event Details</SheetTitle>
          <SheetDescription>
            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <StatusBadge status={event.status} />
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Test Name</p>
              <p className="font-medium">{event.testName}</p>
            </div>
            {event.testFile && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Test File</p>
                <code className="block text-sm bg-muted px-2 py-1 rounded">{event.testFile}</code>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="font-medium">{event.projectName}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Failed Selector
              </p>
              <code className="block text-sm bg-red-500/10 text-red-600 px-3 py-2 rounded font-mono break-all">
                {event.failedSelector}
              </code>
              <p className="text-xs text-muted-foreground">
                Type: {event.selectorType}
              </p>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
            </div>
            {event.newSelector && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Suggested Selector
                </p>
                <code className="block text-sm bg-emerald-500/10 text-emerald-600 px-3 py-2 rounded font-mono break-all">
                  {event.newSelector}
                </code>
                {event.newSelectorType && (
                  <p className="text-xs text-muted-foreground">
                    Type: {event.newSelectorType}
                  </p>
                )}
              </div>
            )}
          </div>
          {event.confidence !== null && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">AI Confidence</p>
                  <p className="text-lg font-bold text-purple-600">
                    {Math.round(event.confidence * 100)}%
                  </p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-sky-500 rounded-full transition-all"
                    style={{ width: `${event.confidence * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}
          {event.reasoning && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">AI Reasoning</p>
                <p className="text-sm text-muted-foreground">{event.reasoning}</p>
              </div>
            </>
          )}
          {(event.status === 'NEEDS_REVIEW' || event.status === 'ANALYZING') && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={onAccept}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Fix
                </Button>
                <Button variant="destructive" className="flex-1" onClick={onReject}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Landing Hero Component
import { motion } from 'framer-motion'

function LandingHero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="relative isolate overflow-hidden min-h-[80vh] flex items-center justify-center">
      {/* Premium Animated Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#38bdf8,transparent)] opacity-20" />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, 0],
            x: [0, 20, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-sky-200/30 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, -5, 0],
            x: [0, -20, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -right-[5%] w-[35%] h-[35%] bg-indigo-200/30 blur-[100px] rounded-full"
        />
      </div>

      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-10 max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <Badge variant="outline" className="px-5 py-1.5 border-sky-200 bg-sky-100/50 text-sky-600 backdrop-blur-sm border-2">
            <Sparkles className="h-3.5 w-3.5 mr-2 animate-pulse" />
            v1.0 MVP is Live 🚀
          </Badge>

          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[1.1]">
            <span className="block text-slate-900">Tests that</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-500 bg-300% animate-gradient">
              heal themselves.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            Healify uses advanced AI to repair broken selectors instantly.
            <span className="text-sky-600 block sm:inline"> Stop maintaining. Start building.</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-5 items-center"
        >
          <Button
            size="lg"
            className="h-14 px-10 text-lg font-bold bg-sky-600 hover:bg-sky-700 shadow-2xl shadow-sky-200 group transition-all duration-300 hover:scale-105"
            onClick={onSignIn}
          >
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-10 text-lg font-bold border-slate-200 bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all"
          >
            Watch Demo
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full pt-16"
        >
          {[
            { icon: Wand2, title: "Self-Healing", desc: "AI-driven selector repair with 98% precision." },
            { icon: FolderGit2, title: "CI/CD Ready", desc: "Native GitHub Actions and Webhook integration." },
            { icon: Activity, title: "Real-time ROI", desc: "Measure time and costs saved per healing event." }
          ].map((feat, i) => (
            <div
              key={i}
              className="group p-8 rounded-3xl bg-white/40 backdrop-blur-md border border-white/60 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-sky-100 transition-all duration-500 hover:-translate-y-2 text-left"
            >
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                <feat.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{feat.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// Main Dashboard Page
export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession()
  // State
  const [projects, setProjects] = useState<Project[]>([])
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [healingEvents, setHealingEvents] = useState<HealingEvent[]>([])
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTestRuns: 0,
    healingSuccessRate: 0,
    testsHealed: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSeedLoading, setIsSeedLoading] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [runningTestsProjectId, setRunningTestsProjectId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTestRun, setSelectedTestRun] = useState<TestRun | null>(null)
  const [selectedHealingEvent, setSelectedHealingEvent] = useState<HealingEvent | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [projectsRes, testRunsRes, healingEventsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/test-runs?limit=20'),
        fetch('/api/healing-events?limit=20'),
      ])

      const projectsData = await projectsRes.json()
      const testRunsData = await testRunsRes.json()
      const healingEventsData = await healingEventsRes.json()

      setProjects(projectsData)

      const testRuns = Array.isArray(testRunsData) ? testRunsData : testRunsData.testRuns || []
      const healingEvents = Array.isArray(healingEventsData) ? healingEventsData : healingEventsData.healingEvents || []

      setTestRuns(testRuns)
      setHealingEvents(healingEvents)

      // Calculate stats
      const totalTestRuns = testRuns.length
      const totalHealed = testRuns.reduce(
        (sum: number, run: TestRun) => sum + (run.healedTests || 0),
        0
      )
      const healingEventsCount = healingEvents.length
      const healedEventsCount = healingEvents.filter(
        (e: HealingEvent) => e.status === 'HEALED_AUTO' || e.status === 'HEALED_MANUAL'
      ).length
      const healingSuccessRate =
        healingEventsCount > 0
          ? Math.round((healedEventsCount / healingEventsCount) * 100)
          : 0

      setStats({
        totalProjects: projectsData.length,
        totalTestRuns,
        healingSuccessRate,
        testsHealed: totalHealed,
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Seed database if empty
  const seedDatabase = useCallback(async () => {
    setIsSeedLoading(true)
    try {
      await fetch('/api/seed')
      await fetchData()
    } catch (error) {
      console.error('Error seeding database:', error)
    } finally {
      setIsSeedLoading(false)
    }
  }, [fetchData])

  // Initial fetch and seed if needed
  useEffect(() => {
    if (authStatus === 'authenticated') {
      const init = async () => {
        await fetchData()
        // Check if we need to seed
        const projectsRes = await fetch('/api/projects')
        const projectsData = await projectsRes.json()
        if (projectsData.length === 0) {
          await seedDatabase()
        }
      }
      init()
    }
  }, [fetchData, seedDatabase, authStatus])

  // Create project
  const handleCreateProject = async (data: {
    name: string
    description: string
    repository: string
  }) => {
    setIsCreatingProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setIsCreateProjectOpen(false)
        await fetchData()
      }
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setIsCreatingProject(false)
    }
  }

  // Run demo simulation
  const handleRunDemo = async () => {
    setIsDemoLoading(true)
    try {
      const res = await fetch('/api/demo/run', { method: 'POST' })
      if (res.ok) {
        await fetchData()
        toast.success('Demo simulation completed successfully!')
      }
    } catch (error) {
      console.error('Error running demo:', error)
    } finally {
      setIsDemoLoading(false)
    }
  }

  // Run real tests for a project
  const handleRunTests = async (projectId: string) => {
    setRunningTestsProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/run`, { method: 'POST' })
      if (res.ok) {
        toast.success('Test run started!')
        await fetchData()
      } else {
        toast.error('Failed to start test run')
      }
    } catch (error) {
      console.error('Error running tests:', error)
      toast.error('An error occurred')
    } finally {
      setRunningTestsProjectId(null)
    }
  }

  // Accept healing fix
  const handleAcceptFix = async (event: HealingEvent) => {
    try {
      await fetch(`/api/healing-events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'HEALED_MANUAL',
          actionTaken: 'manual_accept',
        }),
      })
      await fetchData()
      setSelectedHealingEvent(null)
    } catch (error) {
      console.error('Error accepting fix:', error)
    }
  }

  // Reject healing fix
  const handleRejectFix = async (event: HealingEvent) => {
    try {
      await fetch(`/api/healing-events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IGNORED',
          actionTaken: 'manual_reject',
        }),
      })
      await fetchData()
      setSelectedHealingEvent(null)
    } catch (error) {
      console.error('Error rejecting fix:', error)
    }
  }

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/healify-logo.png"
                alt="Healify"
                className="h-8 w-8 rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Healify</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Tests that heal themselves
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchData()}
                      disabled={isLoading}
                    >
                      <RefreshCw
                        className={cn('h-4 w-4', isLoading && 'animate-spin')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh data</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <NotificationBell />

              {session ? (
                <div className="flex items-center gap-3 ml-2 border-l pl-4">
                  <div className="flex flex-col items-end hidden lg:flex">
                    <p className="text-xs font-medium leading-none">{session.user?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{session.user?.email}</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
                    {session.user?.image ? (
                      <img src={session.user.image} alt={session.user.name || 'User'} className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="default"
                  className="bg-[#24292F] hover:bg-[#24292F]/90 text-white"
                  onClick={() => signIn('github')}
                >
                  <Github className="h-4 w-4 mr-2" />
                  Sign in with GitHub
                </Button>
              )}

              {session && (
                <>
                  <Button
                    variant="outline"
                    className="hidden md:flex bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100 hover:text-sky-700"
                    onClick={handleRunDemo}
                    disabled={isDemoLoading || isLoading}
                  >
                    {isDemoLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Run Demo
                  </Button>

                  <Button onClick={() => setIsCreateProjectOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-6">
        {session ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats Section */}
                <section>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatsCard
                      title="Total Projects"
                      value={stats.totalProjects}
                      icon={FolderGit2}
                      color="default"
                    />
                    <StatsCard
                      title="Total Test Runs"
                      value={stats.totalTestRuns}
                      icon={TestTube}
                      color="info"
                    />
                    <StatsCard
                      title="Healing Success Rate"
                      value={`${stats.healingSuccessRate}%`}
                      icon={Sparkles}
                      color="success"
                      subtitle="AI-powered fixes"
                    />
                    <StatsCard
                      title="Tests Healed"
                      value={stats.testsHealed}
                      icon={Wand2}
                      color="success"
                      subtitle="Auto-fixed tests"
                    />
                  </div>
                </section>

                {/* Projects Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
                      <p className="text-muted-foreground">
                        Manage your test projects and view their status
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setIsCreateProjectOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Project
                    </Button>
                  </div>
                  {projects.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FolderGit2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                        <p className="text-muted-foreground text-center mb-4">
                          Get started by creating your first project
                        </p>
                        <Button onClick={() => setIsCreateProjectOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Project
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onClick={() => setSelectedProject(project)}
                          onRunTests={(e) => {
                            e.stopPropagation()
                            handleRunTests(project.id)
                          }}
                          isRunningTests={runningTestsProjectId === project.id}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Recent Test Runs Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Recent Test Runs</h2>
                      <p className="text-muted-foreground">
                        Latest test executions across all projects
                      </p>
                    </div>
                  </div>
                  {testRuns.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <TestTube className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No test runs yet</h3>
                        <p className="text-muted-foreground text-center">
                          Test runs will appear here when you run tests in your projects
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-0">
                        <ScrollArea className="max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Project</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Tests Passed</TableHead>
                                <TableHead className="text-center">Healed</TableHead>
                                <TableHead className="text-center">Duration</TableHead>
                                <TableHead>Started</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {testRuns.map((run) => (
                                <TableRow
                                  key={run.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => setSelectedTestRun(run)}
                                >
                                  <TableCell className="font-medium">
                                    {run.projectName}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                                      {run.branch || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={run.status} />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-emerald-600 font-medium">
                                      {run.passedTests}
                                    </span>
                                    <span className="text-muted-foreground">/{run.totalTests}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {run.healedTests > 0 ? (
                                      <span className="text-sky-600 font-medium">
                                        {run.healedTests}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">0</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {formatDuration(run.duration)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {formatDistanceToNow(new Date(run.startedAt), {
                                      addSuffix: true,
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </section>

                {/* Healing Events Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Healing Events</h2>
                      <p className="text-muted-foreground">
                        Recent AI-powered test healing activities
                      </p>
                    </div>
                  </div>
                  {healingEvents.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No healing events yet</h3>
                        <p className="text-muted-foreground text-center">
                          Healing events will appear here when tests fail and Healify attempts to fix them
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {healingEvents.map((event) => (
                        <HealingEventCard
                          key={event.id}
                          event={event}
                          onAccept={() => handleAcceptFix(event)}
                          onReject={() => handleRejectFix(event)}
                          onViewDetails={() => setSelectedHealingEvent(event)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        ) : (
          <LandingHero onSignIn={() => signIn('github')} />
        )}
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 border-t bg-background py-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <img
                src="/healify-logo.png"
                alt="Healify"
                className="h-5 w-5 rounded"
              />
              <span>Healify - AI-Powered Test Self-Healing Platform</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground transition-colors">
                Documentation
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                API
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Dialogs and Sheets */}
      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onSubmit={handleCreateProject}
        isLoading={isCreatingProject}
      />

      <ProjectDetailsSheet
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      />

      <TestRunDetailsSheet
        testRun={selectedTestRun}
        open={!!selectedTestRun}
        onOpenChange={(open) => !open && setSelectedTestRun(null)}
      />

      <HealingEventDetailsSheet
        event={selectedHealingEvent}
        open={!!selectedHealingEvent}
        onOpenChange={(open) => !open && setSelectedHealingEvent(null)}
        onAccept={() => selectedHealingEvent && handleAcceptFix(selectedHealingEvent)}
        onReject={() => selectedHealingEvent && handleRejectFix(selectedHealingEvent)}
      />
    </div>
  )
}
