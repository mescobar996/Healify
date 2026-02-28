"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  MoreVertical,
  Github,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, formatRelativeTime, extractRepoName } from "@/lib/api";
import { ProjectsSkeleton } from "@/components/ui/skeletons";
import { createProject, executeTestRun } from "@/lib/actions";
import { toast } from "sonner";
import type { Project, TestRunStatus } from "@/types";

// ============================================
// LINEAR STYLE COMPONENTS
// ============================================

function PlanBadge({ plan }: { plan?: string }) {
  const displayPlan = plan || "FREE";

  const variants: Record<string, { bg: string; text: string }> = {
    FREE: {
      bg: "bg-gray-500/10",
      text: "text-gray-400",
    },
    PRO: {
      bg: "bg-violet-500/10",
      text: "text-violet-400",
    },
    ENTERPRISE: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
    },
  };

  const variant = variants[displayPlan] || variants.FREE;

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
        variant.bg,
        variant.text
      )}
    >
      {displayPlan}
    </span>
  );
}

function ProjectCard({
  project,
  onDelete,
  onEdit,
  onRunTests,
  isRunningTests = false,
  isHighlighted = false,
}: {
  project: Project;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRunTests?: (id: string) => void;
  isRunningTests?: boolean;
  isHighlighted?: boolean;
}) {
  const lastRun = project.lastTestRun;
  const totalTests = lastRun?.totalTests || 0;
  const healedTests = lastRun?.healedTests || 0;
  const failedTests = lastRun?.status === "FAILED" ? 1 : 0;

  return (
    <div className={cn(
      "group relative p-4 rounded-lg glass-elite hover:border-white/10 transition-all duration-150",
      isHighlighted && "ring-1 ring-[#5E6AD2]/60 border-[#5E6AD2]/40"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-violet-400">
              {project.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">{project.name}</h3>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 bg-[#0D1117] border-white/10"
          >
            <DropdownMenuItem 
              className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                onRunTests?.(project.id);
              }}
            >
              {isRunningTests ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Ejecutar Tests
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-300 text-sm focus:bg-white/5 focus:text-white">
              <Link
                href={`/dashboard/tests?project=${project.id}`}
                className="w-full flex items-center"
              >
                Ver tests
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer"
              onClick={() => onEdit?.(project.id)}
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-400 text-sm focus:bg-white/5 focus:text-red-300 cursor-pointer"
              onClick={() => onDelete?.(project.id)}
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-1">
          {project.description}
        </p>
      )}

      {/* Repository */}
      {project.repository && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Github className="w-3.5 h-3.5 text-gray-500" />
          <span className="truncate">
            {extractRepoName(project.repository)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4">
        <div className="text-center p-2 rounded-md bg-white/5">
          <p className="text-lg font-semibold text-white">
            {project.testRunCount}
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
            Runs
          </p>
        </div>
        <div className="text-center p-2 rounded-md bg-emerald-500/5">
          <p className="text-lg font-semibold text-emerald-400">{healedTests}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
            Curados
          </p>
        </div>
        <div className="text-center p-2 rounded-md bg-red-500/5">
          <p className="text-lg font-semibold text-red-400">{failedTests}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
            Fallidos
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          {lastRun
            ? formatRelativeTime(lastRun.startedAt)
            : "Sin ejecuciones"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 sm:h-7 text-xs text-gray-400 hover:text-white"
          onClick={() => onRunTests?.(project.id)}
          disabled={isRunningTests}
        >
          {isRunningTests ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          Run
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-3 rounded-full bg-white/5 mb-3">
        <FolderKanban className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <div className="p-3 rounded-full bg-red-500/10">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-gray-400 text-sm">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reintentar
      </Button>
    </div>
  );
}

// ============================================
// NEW PROJECT MODAL
// ============================================

function NewProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsSubmitting(true);
    toast.info("Creando proyecto...");

    try {
      const result = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        repository: repository.trim() || undefined,
      });

      if (result.success) {
        toast.success("Proyecto creado exitosamente", {
          description: `${name} está listo para usar`,
        });
        setName("");
        setDescription("");
        setRepository("");
        onOpenChange(false);
        onSuccess();
      } else if (result.limitExceeded) {
        toast.error("Límite de plan alcanzado", {
          description: result.error,
          action: {
            label: "Actualizar plan →",
            onClick: () => window.location.href = "/pricing",
          },
          duration: 8000,
        });
      } else {
        toast.error("Error al crear proyecto", {
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast.error("Error inesperado", {
        description: "No se pudo crear el proyecto",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[calc(100vw-2rem)] sm:w-auto bg-[#0D1117] border-white/10">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white">Nuevo Proyecto</DialogTitle>
            <DialogDescription className="text-gray-500">
              Crea un nuevo proyecto para comenzar a monitorear tus tests
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-gray-300">
                Nombre *
              </Label>
              <Input
                id="name"
                placeholder="Mi Proyecto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-glass text-[#E8F0FF] placeholder:text-[#E8F0FF]/30 focus:border-[#00F5C8]/50"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-gray-300">
                Descripción
              </Label>
              <Textarea
                id="description"
                placeholder="Descripción breve del proyecto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input-glass text-[#E8F0FF] placeholder:text-[#E8F0FF]/30 focus:border-[#00F5C8]/50 resize-none"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repository" className="text-gray-300">
                Repositorio
              </Label>
              <Input
                id="repository"
                placeholder="https://github.com/owner/repo"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                type="url"
                className="input-glass text-[#E8F0FF] placeholder:text-[#E8F0FF]/30 focus:border-[#00F5C8]/50"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Proyecto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PROJECTS COMPONENT
// ============================================

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") || "";
  const highlightedProjectId = searchParams.get("projectId");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [runningTestsId, setRunningTestsId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRepository, setEditRepository] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false)

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los proyectos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQuery(q);
  }, [searchParams]);

  // Run Tests handler
  const handleRunTests = async (projectId: string) => {
    setRunningTestsId(projectId);
    toast.info("Iniciando ejecución de tests...", {
      description: "Este proceso puede tardar unos segundos",
    });

    try {
      const result = await executeTestRun(projectId);
      
      if (result.success) {
        toast.success("Tests ejecutados", {
          description: "Revisa los resultados en la página de tests",
        });
        fetchProjects(); // Refresh data
      } else {
        toast.error("Error al ejecutar tests", {
          description: result.error || "Ocurrió un error",
        });
      }
    } catch (error) {
      toast.error("Error inesperado");
    } finally {
      setRunningTestsId(null);
    }
  };

  // Delete project handler
  const handleEditProject = (projectId: string) => {
    const p = projects.find(p => p.id === projectId)
    if (!p) return
    setEditName(p.name || '')
    setEditDescription(p.description || '')
    setEditRepository(p.repository || '')
    setEditProjectId(projectId)
  }

  const confirmEdit = async () => {
    if (!editProjectId || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      await api.updateProject(editProjectId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        repository: editRepository.trim() || undefined,
      })
      toast.success('Proyecto actualizado')
      setProjects(prev => prev.map(p =>
        p.id === editProjectId
          ? ({ ...p, name: editName.trim(), description: editDescription.trim() || null, repository: editRepository.trim() || null } as typeof p)
          : p
      ))
      setEditProjectId(null)
    } catch {
      toast.error('Error al actualizar el proyecto')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    setDeleteConfirmId(projectId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await api.deleteProject(deleteConfirmId);
      toast.success("Proyecto eliminado");
      setProjects(prev => prev.filter(p => p.id !== deleteConfirmId));
    } catch {
      toast.error("Error al eliminar el proyecto");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleTryDemoRepo = async () => {
    try {
      setIsSeedingDemo(true)
      toast.info('Preparando demo repo...')
      const response = await fetch('/api/seed', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'No se pudo cargar la demo')
      }

      const body = await response.json()
      if (body?.message?.includes('already seeded')) {
        toast.success('Demo ya disponible', {
          description: 'Ya tenés datos de demo cargados en tu cuenta.',
        })
      } else {
        toast.success('Demo lista', {
          description: 'Se crearon proyectos y test runs de ejemplo.',
        })
      }

      await fetchProjects()
      router.push('/dashboard/tests')
    } catch (error) {
      toast.error('Error al cargar demo', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente',
      })
    } finally {
      setIsSeedingDemo(false)
    }
  }

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.repository?.toLowerCase().includes(query)
      );
    }

    if (statusFilter === "active") {
      filtered = filtered.filter((p) => p.lastTestRun !== null);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((p) => p.lastTestRun === null);
    }

    return filtered;
  }, [projects, searchQuery, statusFilter]);

  if (loading) {
    return <ProjectsSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchProjects} />;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Proyectos
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona tus proyectos y monitorea sus tests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSeedingDemo}
              onClick={handleTryDemoRepo}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              {isSeedingDemo ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Github className="w-3.5 h-3.5 mr-1.5" />
              )}
              Try with demo repo
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto"
              onClick={() => setIsNewProjectOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuevo Proyecto
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              placeholder="Buscar proyectos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 input-glass text-[#E8F0FF] placeholder:text-[#E8F0FF]/30"
            />
          </div>
          <div className="flex gap-2">
            {[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Inactivos" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value as typeof statusFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                  statusFilter === f.value
                    ? "bg-white/5 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <EmptyState
            title={searchQuery ? "Sin resultados" : "No hay proyectos"}
            description={
              searchQuery
                ? "No se encontraron proyectos para tu búsqueda"
                : "Crea tu primer proyecto para comenzar a monitorear tests"
            }
            action={
              !searchQuery && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSeedingDemo}
                    className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                    onClick={handleTryDemoRepo}
                  >
                    {isSeedingDemo ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Github className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Try with demo repo
                  </Button>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => setIsNewProjectOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Crear Proyecto
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRunTests={handleRunTests}
                isRunningTests={runningTestsId === project.id}
                onDelete={handleDeleteProject}
                onEdit={handleEditProject}
                isHighlighted={highlightedProjectId === project.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        onSuccess={() => {
          fetchProjects();
          router.refresh();
        }}
      />

      {/* Edit Project Dialog */}
      <AlertDialog open={!!editProjectId} onOpenChange={(open) => !open && setEditProjectId(null)}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Editar proyecto</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 sr-only">
              Actualizar datos del proyecto
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#7B5EF8]/50"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Nombre del proyecto"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Descripción</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#7B5EF8]/50"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Repositorio</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#7B5EF8]/50"
                value={editRepository}
                onChange={e => setEditRepository(e.target.value)}
                placeholder="https://github.com/user/repo"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
              onClick={() => setEditProjectId(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEdit}
              disabled={isSavingEdit || !editName.trim()}
              className="bg-[#7B5EF8] hover:bg-[#7B5EF8]/90 text-white border-0"
            >
              {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta acción eliminará el proyecto y todos sus test runs, selectores y eventos de autocuración.
              <span className="block mt-2 text-red-400 font-medium">Esta acción no se puede deshacer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {isDeleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}