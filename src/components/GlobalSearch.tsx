"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileCode2, FolderKanban, Search, Wrench } from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
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
      } catch {}
    }, 220)

    return () => clearTimeout(timer)
  }, [query])

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
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-all duration-150 group"
      >
        <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
        <span className="text-[13px] text-[var(--text-secondary)]">Buscar...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-4 text-[10px] text-[var(--text-tertiary)] bg-[#111111] px-1.5 py-0.5 rounded font-mono">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Búsqueda global"
        description="Buscar proyectos, ejecuciones y eventos de curación"
        className="bg-[#111111] border-white/[0.08]"
      >
        <CommandInput placeholder="Buscar por proyecto, commit, test, selector..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{query.trim().length < 2 ? "Escribí al menos 2 caracteres" : "Sin resultados"}</CommandEmpty>

          <CommandGroup heading="Proyectos">
            {activeResults.projects.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  router.push("/dashboard/projects")
                  setOpen(false)
                }}
              >
                <FolderKanban className="w-4 h-4" />
                <span>{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Test runs">
            {activeResults.testRuns.map((run) => (
              <CommandItem
                key={run.id}
                onSelect={() => {
                  router.push("/dashboard/tests")
                  setOpen(false)
                }}
              >
                <FileCode2 className="w-4 h-4" />
                <span>{run.project.name} · {run.branch || run.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Curaciones">
            {activeResults.healingEvents.map((event) => (
              <CommandItem
                key={event.id}
                onSelect={() => {
                  if (event.prUrl) {
                    window.open(event.prUrl, "_blank", "noopener,noreferrer")
                  } else {
                    router.push("/dashboard/tests")
                  }
                  setOpen(false)
                }}
              >
                <Wrench className="w-4 h-4" />
                <span>{event.testName} · {event.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {query.trim().length >= 2 && total > 0 && (
            <div className="px-3 py-2 text-[10px] text-[#6B6B6B] border-t border-white/[0.08]">
              {total} resultado(s)
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
