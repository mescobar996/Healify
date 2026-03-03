'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  Users,
  ListChecks,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  role: string
  createdAt: string
  _count: { projects: number }
}

interface WaitlistEntry {
  id: string
  email: string
  name: string | null
  plan: string
  source: string
  createdAt: string
}

type Tab = 'users' | 'waitlist'

// ── Helpers ────────────────────────────────────────────────────────────────

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => JSON.stringify(r[h] ?? '')).join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', color)}>
      {label}
    </span>
  )
}

// ── Admin Panel ────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('users')

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [waitlistTotal, setWaitlistTotal] = useState(0)
  const [waitlistPage, setWaitlistPage] = useState(1)

  const [loading, setLoading] = useState(false)

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=25`, { credentials: 'include' })
      if (res.status === 403) { router.push('/dashboard'); return }
      const data = await res.json()
      setUsers(data.users ?? [])
      setUsersTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [router])

  const fetchWaitlist = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/waitlist?page=${page}&limit=50`, { credentials: 'include' })
      if (res.status === 403) { router.push('/dashboard'); return }
      const data = await res.json()
      setWaitlist(data.entries ?? [])
      setWaitlistTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { if (tab === 'users') fetchUsers(usersPage) }, [tab, usersPage, fetchUsers])
  useEffect(() => { if (tab === 'waitlist') fetchWaitlist(waitlistPage) }, [tab, waitlistPage, fetchWaitlist])

  // Guard
  if (status === 'loading') return null
  if (!session) { router.push('/auth/signin'); return null }

  const LIMIT_USERS = 25
  const LIMIT_WAITLIST = 50

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Shield className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#E8F0FF]">Panel de Administración</h1>
          <p className="text-xs text-gray-500">Solo visible para administradores</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 w-fit">
        {([
          { id: 'users', label: 'Usuarios', icon: Users, count: usersTotal },
          { id: 'waitlist', label: 'Waitlist', icon: ListChecks, count: waitlistTotal },
        ] as { id: Tab; label: string; icon: React.ElementType; count: number }[]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all',
              tab === id
                ? 'bg-violet-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && (
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-xl bg-[#111318] border border-white/5 overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="text-xs text-gray-500">
            {tab === 'users'
              ? `${usersTotal} usuarios registrados`
              : `${waitlistTotal} entradas en waitlist`}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-gray-400"
              onClick={() => tab === 'users' ? fetchUsers(usersPage) : fetchWaitlist(waitlistPage)}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-gray-400"
              onClick={() => {
                if (tab === 'users') {
                  exportCsv(users.map(u => ({
                    id: u.id, name: u.name, email: u.email,
                    role: u.role, projects: u._count.projects,
                    createdAt: u.createdAt,
                  })), 'healify-users.csv')
                } else {
                  exportCsv(waitlist.map(w => ({
                    id: w.id, email: w.email, name: w.name,
                    plan: w.plan, source: w.source, createdAt: w.createdAt,
                  })), 'healify-waitlist.csv')
                }
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          </div>
        )}

        {/* Users table */}
        {!loading && tab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left px-4 py-2 font-normal">Usuario</th>
                  <th className="text-left px-4 py-2 font-normal">Rol</th>
                  <th className="text-left px-4 py-2 font-normal">Proyectos</th>
                  <th className="text-left px-4 py-2 font-normal">Registro</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-[#E8F0FF] font-medium">{u.name ?? '—'}</p>
                      <p className="text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={u.role}
                        color={u.role === 'admin' ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-gray-400'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{u._count.projects}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Waitlist table */}
        {!loading && tab === 'waitlist' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left px-4 py-2 font-normal">Email</th>
                  <th className="text-left px-4 py-2 font-normal">Nombre</th>
                  <th className="text-left px-4 py-2 font-normal">Plan</th>
                  <th className="text-left px-4 py-2 font-normal">Fuente</th>
                  <th className="text-left px-4 py-2 font-normal">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map(w => (
                  <tr key={w.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[#E8F0FF] font-mono">{w.email}</td>
                    <td className="px-4 py-3 text-gray-400">{w.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={w.plan}
                        color={w.plan === 'enterprise' ? 'bg-amber-500/20 text-amber-300' : w.plan === 'pro' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{w.source}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-[10px] text-gray-600">
              Página {tab === 'users' ? usersPage : waitlistPage}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                disabled={tab === 'users' ? usersPage <= 1 : waitlistPage <= 1}
                onClick={() => tab === 'users' ? setUsersPage(p => p - 1) : setWaitlistPage(p => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                disabled={
                  tab === 'users'
                    ? usersPage * LIMIT_USERS >= usersTotal
                    : waitlistPage * LIMIT_WAITLIST >= waitlistTotal
                }
                onClick={() => tab === 'users' ? setUsersPage(p => p + 1) : setWaitlistPage(p => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
