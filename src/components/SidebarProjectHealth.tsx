"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"

type ProjectHealth = {
  id: string
  name: string
  lastTestRun: {
    status: string
  } | null
}

function statusTone(status?: string | null) {
  if (!status) return { dot: "bg-[#6B6B6B]", label: "Sin ejecuciones" }
  if (status === "PASSED" || status === "HEALED") return { dot: "bg-emerald-400", label: "Saludable" }
  if (status === "RUNNING" || status === "PENDING" || status === "PARTIAL") return { dot: "bg-amber-400", label: "En observación" }
  return { dot: "bg-red-400", label: "Atención" }
}

export function SidebarProjectHealth() {
  const [projects, setProjects] = useState<ProjectHealth[]>([])

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setProjects([]))
  }, [])

  return (
    <div className="pt-4 mt-4 border-t border-[var(--border-default)]">
      <div className="px-2 py-2 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        <span className="text-[10px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
          Salud de proyectos
        </span>
      </div>

      {projects.length === 0 ? (
        <p className="px-2.5 py-1 text-[11px] text-[var(--text-tertiary)]">Sin proyectos aún</p>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => {
            const tone = statusTone(project.lastTestRun?.status)
            return (
              <Link
                key={project.id}
                href="/dashboard/projects"
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className={cn("w-2 h-2 rounded-full", tone.dot)} />
                <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">{project.name}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{tone.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
