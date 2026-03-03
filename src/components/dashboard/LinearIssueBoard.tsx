"use client"

import React, { useMemo, useState } from "react"
import { Bug, CheckCircle2, ChevronLeft, Circle, Clock3, Filter, LayoutDashboard, Search, Settings2, Sparkles, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

type IssueStatus = "todo" | "in-progress" | "done" | "blocked"
type BoardState = "loading" | "empty" | "error" | "success"

interface Issue {
  id: string
  title: string
  status: IssueStatus
  priority: "low" | "medium" | "high"
  assignee: string
  updatedAt: string
}

const ISSUES: Issue[] = [
  {
    id: "QA-341",
    title: "Flaky selector in checkout flow",
    status: "in-progress",
    priority: "high",
    assignee: "Camila",
    updatedAt: "hace 8m",
  },
  {
    id: "QA-339",
    title: "Intermittent auth timeout on mobile",
    status: "blocked",
    priority: "high",
    assignee: "Diego",
    updatedAt: "hace 16m",
  },
  {
    id: "QA-335",
    title: "Refactor API smoke tests",
    status: "todo",
    priority: "medium",
    assignee: "Sofía",
    updatedAt: "hace 43m",
  },
  {
    id: "QA-330",
    title: "Visual regression baseline update",
    status: "done",
    priority: "low",
    assignee: "Mateo",
    updatedAt: "hace 1h",
  },
]

function StatusIcon({ status }: { status: IssueStatus }) {
  if (status === "done") return <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
  if (status === "in-progress") return <Clock3 className="w-3.5 h-3.5" aria-hidden="true" />
  if (status === "blocked") return <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
  return <Circle className="w-3.5 h-3.5" aria-hidden="true" />
}

function statusLabel(status: IssueStatus) {
  if (status === "done") return "Done"
  if (status === "in-progress") return "In Progress"
  if (status === "blocked") return "Blocked"
  return "Todo"
}

export function LinearIssueBoard({ state = "success" }: { state?: BoardState }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedIssueId, setSelectedIssueId] = useState(ISSUES[0]?.id ?? "")
  const [query, setQuery] = useState("")

  const filteredIssues = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ISSUES
    return ISSUES.filter((issue) => {
      return issue.title.toLowerCase().includes(normalized) || issue.id.toLowerCase().includes(normalized)
    })
  }, [query])

  return (
    <section className="linear-surface rounded-lg border border-white/10 overflow-hidden" aria-label="Issue tracker board">
      <div className="linear-noise-overlay" aria-hidden="true" />
      <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr] min-h-[420px]">
        <aside
          aria-label="Issue navigation"
          className={cn(
            "linear-glass border-r border-white/8 transition-all duration-150 ease-out",
            sidebarCollapsed ? "w-full lg:w-[60px]" : "w-full lg:w-[220px]"
          )}
        >
          <div className="h-full p-2.5">
            <button
              type="button"
              className="linear-row w-full justify-between"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            >
              {!sidebarCollapsed && <span className="text-[11px] text-[#8A8F98]">Workspace</span>}
              <ChevronLeft className={cn("w-3.5 h-3.5 text-[#8A8F98] transition-transform", sidebarCollapsed && "rotate-180")} />
            </button>

            <nav className="mt-2 space-y-1" role="navigation" aria-label="Main navigation">
              <button type="button" className="linear-nav-item linear-nav-item-active" aria-current="page">
                <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={1.5} />
                {!sidebarCollapsed && <span>Issues</span>}
              </button>
              <button type="button" className="linear-nav-item">
                <Bug className="w-3.5 h-3.5" strokeWidth={1.5} />
                {!sidebarCollapsed && <span>Bugs</span>}
              </button>
              <button type="button" className="linear-nav-item">
                <Settings2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {!sidebarCollapsed && <span>Settings</span>}
              </button>
            </nav>
          </div>
        </aside>

        <div className="flex flex-col">
          <header className="h-11 border-b border-white/8 px-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8F98]" strokeWidth={1.5} />
              <input
                className="linear-input pl-7"
                placeholder="Search issues..."
                aria-label="Buscar issues"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="linear-icon-btn" aria-label="Filtrar issues" type="button">
              <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button className="linear-btn" type="button">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              New Issue
            </button>
          </header>

          <div className="p-2.5 content-visibility-auto">
            {state === "loading" && (
              <div className="space-y-2" role="status" aria-live="polite" aria-label="Cargando issues">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="h-12 rounded-md border border-white/8 bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            )}

            {state === "error" && (
              <div className="linear-state" role="alert" aria-live="assertive">
                <TriangleAlert className="w-4 h-4 text-[#8A8F98]" strokeWidth={1.5} />
                <p className="text-[12px] text-white">No pudimos cargar los issues.</p>
                <p className="text-[11px] text-[#8A8F98]">Reintentá en unos segundos.</p>
              </div>
            )}

            {state === "empty" && (
              <div className="linear-state" role="status" aria-live="polite">
                <Circle className="w-4 h-4 text-[#8A8F98]" strokeWidth={1.5} />
                <p className="text-[12px] text-white">No hay issues por ahora.</p>
                <p className="text-[11px] text-[#8A8F98]">Creá el primero para empezar el tracking.</p>
              </div>
            )}

            {state === "success" && (
              <ul role="list" aria-label="Issue list" className="space-y-1">
                {filteredIssues.map((issue) => {
                  const isActive = selectedIssueId === issue.id
                  return (
                    <li key={issue.id}>
                      <button
                        type="button"
                        data-testid="issue-row"
                        className={cn("linear-row w-full", isActive && "linear-row-active")}
                        aria-pressed={isActive}
                        onClick={() => setSelectedIssueId(issue.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#8A8F98]">
                            <StatusIcon status={issue.status} />
                          </span>
                          <div className="text-left min-w-0">
                            <p className="text-[12px] text-white truncate">{issue.title}</p>
                            <p className="text-[11px] text-[#8A8F98] truncate">
                              {issue.id} · {issue.assignee} · {issue.updatedAt}
                            </p>
                          </div>
                        </div>

                        <span className="linear-badge" aria-label={`Status ${statusLabel(issue.status)}`}>
                          {statusLabel(issue.status)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
