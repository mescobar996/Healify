"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Key,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Github,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// ============================================
// MOCK DATA
// ============================================

// userData is now populated from session — no hardcoded defaults
const userData = {
  name: "",
  email: "",
  avatar: "/avatar.png",
  plan: "PRO",
};


// ============================================
// TAB COMPONENT
// ============================================

const tabs = [
  { id: "account", label: "Cuenta", icon: User },
  { id: "api", label: "API Keys", icon: Key },
  { id: "billing", label: "Facturación", icon: CreditCard },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "appearance", label: "Apariencia", icon: Palette },
  { id: "integrations", label: "Integraciones", icon: Github },
] as const;

type TabId = typeof tabs[number]["id"];

// ============================================
// SETTINGS SECTIONS
// ============================================

function AccountSection() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Populate fields from session when it loads
  React.useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success("Perfil actualizado correctamente");
    } catch {
      toast.error("Error al actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-start gap-6">
        <Avatar className="w-16 h-16">
          <AvatarImage src={session?.user?.image || userData.avatar} />
          <AvatarFallback className="text-[#090909] text-lg font-medium" style={{background:"linear-gradient(135deg,#5E6AD2,#7A84DC)"}}>
            {session?.user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2) || "HF"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className=""
          >
            Cambiar avatar
          </Button>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            JPG, PNG o GIF. Máximo 2MB.
          </p>
        </div>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs text-[var(--text-secondary)]">
            Nombre
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className=""
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs text-[var(--text-secondary)]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className=""
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className=""
        >
          {saving ? (
            <>
              <span className="animate-spin mr-1.5">⏳</span>
              Guardando...
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const [showApiKey, setShowApiKey] = useState<number | string | null>(null);
  const [dynamicApiKeys, setDynamicApiKeys] = useState<Array<{id: string|number, name: string, key: string, createdAt: string, lastUsed: string}>>([]);
  const [copied, setCopied] = useState<number | string | null>(null);

  const copyToClipboard = (text: string, id: number | string) => {
    void id; // suppress unused
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("API Key copiada al portapapeles");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateNewKey = () => {
    toast.promise(
      fetch('/api/projects', { credentials: 'include' })
        .then(r => r.json())
        .then(projects => {
          if (!projects?.length) throw new Error('No hay proyectos');
          return projects[0].apiKey || 'Actualizado';
        }),
      {
        loading: "Generando nueva API Key...",
        success: (key: string) => `Nueva API Key lista`,
        error: "Primero creá un proyecto para obtener una API Key",
      }
    );
  };

  return (
    <div className="space-y-4">
      {dynamicApiKeys.length > 0 ? dynamicApiKeys.map((apiKey) => (
        <div
          key={apiKey.id}
          className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{apiKey.name}</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Creada: {apiKey.createdAt} • Último uso: {apiKey.lastUsed}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setShowApiKey(showApiKey === apiKey.id ? null : apiKey.id)
                }
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                {showApiKey === apiKey.id ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                {copied === apiKey.id ? (
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <code className="block p-2 bg-[var(--bg-primary)] rounded text-xs font-mono text-[var(--text-secondary)]">
            {showApiKey === apiKey.id
              ? apiKey.key
              : apiKey.key.slice(0, 12) + "•".repeat(24) + apiKey.key.slice(-4)}
          </code>
        </div>
      )) : (
        <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
          Creá un proyecto para obtener tu API Key
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateNewKey}
        className="w-full"
      >
        <Key className="w-3.5 h-3.5 mr-1.5" />
        Generar nueva API Key
      </Button>
    </div>
  );
}

function BillingSection() {
  const [sub, setSub] = React.useState<{
    plan: string; status: string; currentPeriodEnd: string | null
  } | null>(null)
  const [subLoading, setSubLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/user/subscription', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSub(d) })
      .catch(() => {})
      .finally(() => setSubLoading(false))
  }, [])

  const planMeta: Record<string, { label: string; price: string; color: string; projects: string; runs: string }> = {
    FREE:       { label: 'Free',       price: '$0/mes',   color: 'text-gray-400',    projects: '1',       runs: '50/mes' },
    STARTER:    { label: 'Starter',    price: '$49/mes',  color: 'text-cyan-400',    projects: '5',       runs: '100/mes' },
    PRO:        { label: 'Pro',        price: '$99/mes',  color: 'text-violet-400',  projects: '∞',       runs: '1.000/mes' },
    ENTERPRISE: { label: 'Enterprise', price: '$499/mes', color: 'text-amber-400',   projects: '∞',       runs: '∞' },
  }

  const planKey = sub?.plan || 'FREE'
  const meta = planMeta[planKey] || planMeta.FREE
  const isActive = sub?.status === 'active' || !sub
  const renewalDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-violet-500/10">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            {subLoading ? (
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${meta.color}`}>
                    Plan {meta.label}
                  </p>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                    isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {isActive ? 'Activo' : sub?.status || 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {meta.price}
                  {renewalDate && ` • Renovación: ${renewalDate}`}
                </p>
              </>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className=""
          asChild
        >
          <a href="/pricing">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {planKey === 'FREE' ? 'Actualizar plan' : 'Cambiar plan'}
          </a>
        </Button>
      </div>

      {/* Limits reales por plan */}
      <div>
        <h4 className="text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
          Límites del plan actual
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: meta.projects, label: 'Proyectos' },
            { value: meta.runs,     label: 'Test runs/mes' },
            { value: planKey === 'FREE' ? 'Email' : 'Email + Slack', label: 'Notificaciones' },
            { value: planKey === 'ENTERPRISE' ? 'Dedicado' : planKey === 'PRO' ? 'Prioritario' : 'Email', label: 'Soporte' },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <p className="text-lg font-semibold text-[var(--text-primary)]">{item.value}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { data: session } = useSession();
  const [slackUrl, setSlackUrl] = useState("");
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackSaved, setSlackSaved] = useState(false);

  // Load existing slack URL
  React.useEffect(() => {
    fetch("/api/user/profile/slack", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slackWebhookUrl) setSlackUrl(d.slackWebhookUrl) })
      .catch(() => {})
  }, []);

  const handleSlackSave = async () => {
    setSlackSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slackWebhookUrl: slackUrl }),
      });
      if (res.ok) {
        setSlackSaved(true);
        toast.success("Slack configurado", { description: "Las notificaciones se enviarán a tu canal." });
        setTimeout(() => setSlackSaved(false), 3000);
      } else {
        const { error } = await res.json();
        toast.error(error || "Error al guardar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setSlackSaving(false);
    }
  };

  const handleSlackDisconnect = async () => {
    setSlackUrl("");
    await fetch("/api/user/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slackWebhookUrl: null }),
    });
    toast.success("Slack desconectado");
  };

  return (
    <div className="space-y-4">
      {/* Email — informativo, viene del OAuth */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Email de autocuración</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {session?.user?.email
                ? <>Emails enviados a <span className="text-[var(--accent-primary)]">{session.user.email}</span></>
                : "Recibe un email cuando un test se autocure"}
            </p>
          </div>
          <Switch checked disabled className="opacity-50" />
        </div>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Alertas de fallos</p>
            <p className="text-xs text-[var(--text-tertiary)]">Notificación cuando un test falle sin curación</p>
          </div>
          <Switch checked disabled className="opacity-50" />
        </div>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Slack — input real */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Slack integration</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            Pegá el <span className="text-[var(--accent-primary)]">Incoming Webhook URL</span> de tu canal de Slack.{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              ¿Cómo crearlo?
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="flex-1 text-sm"
          />
          {slackUrl ? (
            <Button
              size="sm"
              onClick={handleSlackSave}
              disabled={slackSaving}
              className="text-xs px-3 shrink-0"
            >
              {slackSaving ? "..." : slackSaved ? "✓ Guardado" : "Guardar"}
            </Button>
          ) : null}
        </div>
        {slackUrl && (
          <button
            onClick={handleSlackDisconnect}
            className="text-xs text-red-400/80 hover:text-red-400 transition-colors"
          >
            Desconectar Slack
          </button>
        )}
      </div>
    </div>
  );
}

function AppearanceSection() {
  const [accent, setAccent] = useState("violet");

  const accents = [
    { id: "violet", color: "bg-violet-500" },
    { id: "blue", color: "bg-blue-500" },
    { id: "emerald", color: "bg-emerald-500" },
    { id: "amber", color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* App is always dark mode — Healify design system */}
      <div className="rounded-xl p-4 flex items-center gap-3 border border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <div className="w-3 h-3 rounded-full bg-[var(--accent-primary)]" />
        <p className="text-sm text-[var(--text-secondary)]">Healify utiliza diseño oscuro permanente optimizado para desarrolladores.</p>
      </div>

      {/* Accent Color */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Color de acento</p>
          <p className="text-xs text-[var(--text-tertiary)]">Color principal de la interfaz</p>
        </div>
        <div className="flex gap-2">
          {accents.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              className={cn(
                "w-7 h-7 rounded-full transition-all",
                a.color,
                accent === a.id
                  ? "ring-2 ring-offset-2 ring-offset-[#111113] ring-white"
                  : "hover:ring-2 hover:ring-offset-2 hover:ring-offset-[#111113] hover:ring-white/50"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationsSection() {
  return (
    <div className="space-y-4">
      {/* GitHub */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Github className="w-6 h-6 text-[var(--text-secondary)]" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">@johndoe</p>
            <p className="text-xs text-[var(--text-tertiary)]">Conectado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
            Sincronizado
          </span>
          <Button
            variant="outline"
            size="sm"
            className=""
          >
            Desconectar
          </Button>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-secondary)]">Más integraciones próximamente</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          GitLab, Bitbucket, Jenkins...
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN SETTINGS PAGE
// ============================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("account");

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <AccountSection />;
      case "api":
        return <ApiKeysSection />;
      case "billing":
        return <BillingSection />;
      case "notifications":
        return <NotificationsSection />;
      case "appearance":
        return <AppearanceSection />;
      case "integrations":
        return <IntegrationsSection />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--border-default)] overflow-x-auto">
        <div className="flex items-center gap-5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 py-2 text-[13px] font-medium border-b transition-colors",
                  isActive
                    ? "text-[var(--text-primary)] border-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-medium text-[var(--text-primary)]">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
        </div>

        <div className="p-6">{renderContent()}</div>
      </div>
    </div>
  );
}