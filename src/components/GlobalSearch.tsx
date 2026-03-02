"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileCode2, FolderKanban, Search, Wrench, Settings, BarChart3, BookOpen, Zap, ArrowRight, Clock } from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"

type SearchResponse = {
  projects: Array<{ id: string; name: string; repository: string | null }>
  testRuns: Array<{ id: string; status: string; branch: string | null; commitMessage: string | null; project: { id: string; name: string } }>
  healingEvents: Array<{ id: string; testName: string; status: string; confidence: number | null; prUrl: string | null; testRun: { id: string; project: { id: string; name: string } } }>
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse>({ projects: [], testRuns: [], healingEvents: [] })
  const [lastTrackedQuery, setLastTrackedQuery] = useState("")
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("healify_recent_searches")
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch {}
  }, [])

  const addRecentSearch = useCallback((q: string) => {
    setRecentSearches(prev => {
      const updated = [q, ...prev.filter(s => s !== q)].slice(0, 5)
      try { localStorage.setItem("healify_recent_searches", JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [])

  const trackEvent = async (event: string, metadata: Record<string, unknown>) => {
    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, metadata }),
      })
    } catch {}
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
        void trackEvent("search_open", { source: "keyboard" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" })
        if (!response.ok) return
        const payload = await response.json()
        setResults({
          projects: payload.projects || [],
          testRuns: payload.testRuns || [],
          healingEvents: payload.healingEvents || [],
        })

        if (q !== lastTrackedQuery) {
          setLastTrackedQuery(q)
          void trackEvent("search_query", {
            query: q,
            resultCount:
              (payload.projects || []).length +
              (payload.testRuns || []).length +
              (payload.healingEvents || []).length,
          })
        }
      } catch {}
    }, 220)

    return () => clearTimeout(timer)
  }, [query, lastTrackedQuery])

  const activeResults = query.trim().length < 2
    ? { projects: [], testRuns: [], healingEvents: [] }
    : results

  const total = useMemo(
    () => activeResults.projects.length + activeResults.testRuns.length + activeResults.healingEvents.length,
    [activeResults]
  )

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          void trackEvent("search_open", { source: "mobile_button" })
        }}
        aria-label="Abrir búsqueda global"
        className="inline-flex md:hidden items-center justify-center h-9 w-9 rounded-lg bg-[#0A0A0A] border border-white/[0.06] text-[var(--text-secondary)] hover:text-[#5E6AD2] hover:border-white/[0.12] transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      <button
        onClick={() => {
          setOpen(true)
          void trackEvent("search_open", { source: "button" })
        }}
        className="hidden md:flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#0A0A0A] border border-white/[0.06] hover:bg-[#111111] hover:border-white/[0.12] transition-all duration-150 group w-[380px] lg:w-[460px] xl:w-[560px]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[#5E6AD2] transition-colors" />
          <span className="text-[13px] text-[var(--text-secondary)] truncate">Buscar proyectos, tests, PRs, commits...</span>
        </div>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)] bg-[#000000] border border-white/[0.06] px-1.5 py-0.5 rounded font-mono shrink-0">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Búsqueda global"
        description="Buscar proyectos, ejecuciones y eventos de curación"
        className="bg-[#0A0A0A] border-white/[0.06]"
      >
        <CommandInput placeholder="Buscar por proyecto, commit, test, selector..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{query.trim().length < 2 ? "Escribí al menos 2 caracteres" : "Sin resultados"}</CommandEmpty>

          {/* Quick actions when no query */}
          {query.trim().length < 2 && (
            <>
              {recentSearches.length > 0 && (
                <CommandGroup heading="Búsquedas recientes">
                  {recentSearches.map((s) => (
                    <CommandItem key={s} onSelect={() => setQuery(s)}>
                      <Clock className="w-3.5 h-3.5 text-[#6B6B6B]" />
                      <span className="text-[#9B9B9B]">{s}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup heading="Accesos rápidos">
                <CommandItem onSelect={() => { router.push("/dashboard"); setOpen(false) }}>
                  <BarChart3 className="w-4 h-4 text-[#5E6AD2]" />
                  <span>Dashboard</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[#6B6B6B]" />
                </CommandItem>
                <CommandItem onSelect={() => { router.push("/dashboard/projects"); setOpen(false) }}>
                  <FolderKanban className="w-4 h-4 text-[#3DB779]" />
                  <span>Proyectos</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[#6B6B6B]" />
                </CommandItem>
                <CommandItem onSelect={() => { router.push("/dashboard/tests"); setOpen(false) }}>
                  <Zap className="w-4 h-4 text-[#E8A642]" />
                  <span>Test Runs</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[#6B6B6B]" />
                </CommandItem>
                <CommandItem onSelect={() => { router.push("/docs"); setOpen(false) }}>
                  <BookOpen className="w-4 h-4 text-[#4E9FE8]" />
                  <span>Documentación</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[#6B6B6B]" />
                </CommandItem>
                <CommandItem onSelect={() => { router.push("/dashboard/settings"); setOpen(false) }}>
                  <Settings className="w-4 h-4 text-[#9B9B9B]" />
                  <span>Configuración</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[#6B6B6B]" />
                </CommandItem>
              </CommandGroup>
            </>
          )}

          <CommandGroup heading="Proyectos">
            {activeResults.projects.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  addRecentSearch(p.name)
                  void trackEvent("search_result_click", {
                    type: "project",
                    projectId: p.id,
                    query: query.trim(),
                  })
                  router.push(`/dashboard/projects?q=${encodeURIComponent(p.name)}&projectId=${encodeURIComponent(p.id)}`)
                  setOpen(false)
                }}
              >
                <FolderKanban className="w-4 h-4 text-[#3DB779]" />
                <span>{p.name}</span>
                {p.repository && <span className="ml-auto text-[10px] text-[#6B6B6B] font-mono truncate max-w-[200px]">{p.repository}</span>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Test runs">
            {activeResults.testRuns.map((run) => (
              <CommandItem
                key={run.id}
                onSelect={() => {
                  addRecentSearch(run.branch || run.commitMessage || run.status)
                  void trackEvent("search_result_click", {
                    type: "test_run",
                    runId: run.id,
                    projectId: run.project.id,
                    query: query.trim(),
                  })
                  const q = run.branch || run.commitMessage || run.status
                  router.push(`/dashboard/tests?project=${encodeURIComponent(run.project.id)}&q=${encodeURIComponent(q)}&runId=${encodeURIComponent(run.id)}`)
                  setOpen(false)
                }}
              >
                <FileCode2 className="w-4 h-4 text-[#4E9FE8]" />
                <span>{run.project.name} · {run.branch || run.status}</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  run.status === "HEALED" ? "bg-emerald-500/10 text-emerald-400" :
                  run.status === "PASSED" ? "bg-blue-500/10 text-blue-400" :
                  run.status === "FAILED" ? "bg-red-500/10 text-red-400" :
                  "bg-white/[0.05] text-[#6B6B6B]"
                }`}>{run.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Curaciones">
            {activeResults.healingEvents.map((event) => (
              <CommandItem
                key={event.id}
                onSelect={() => {
                  addRecentSearch(event.testName)
                  if (event.prUrl) {
                    void trackEvent("search_result_click", {
                      type: "healing_event_pr",
                      healingEventId: event.id,
                      query: query.trim(),
                    })
                    window.open(event.prUrl, "_blank", "noopener,noreferrer")
                  } else {
                    void trackEvent("search_result_click", {
                      type: "healing_event",
                      healingEventId: event.id,
                      runId: event.testRun.id,
                      projectId: event.testRun.project.id,
                      query: query.trim(),
                    })
                    router.push(`/dashboard/tests?project=${encodeURIComponent(event.testRun.project.id)}&q=${encodeURIComponent(event.testName)}&runId=${encodeURIComponent(event.testRun.id)}`)
                  }
                  setOpen(false)
                }}
              >
                <Wrench className="w-4 h-4 text-[#E8A642]" />
                <span>{event.testName}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {event.confidence != null && (
                    <span className="text-[10px] text-[#6B6B6B] font-mono">{Math.round(event.confidence * 100)}%</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    event.status === "HEALED_AUTO" ? "bg-emerald-500/10 text-emerald-400" :
                    event.status === "NEEDS_REVIEW" ? "bg-amber-500/10 text-amber-400" :
                    event.status === "BUG_DETECTED" ? "bg-red-500/10 text-red-400" :
                    "bg-white/[0.05] text-[#6B6B6B]"
                  }`}>{event.status}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          {query.trim().length >= 2 && total > 0 && (
            <div className="px-3 py-2 text-[10px] text-[#6B6B6B] border-t border-white/[0.06] flex items-center justify-between">
              <span>{total} resultado(s)</span>
              <span className="text-[#5E6AD2]">↑↓ navegar · ↵ seleccionar · esc cerrar</span>
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
