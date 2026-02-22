"use client";

import React, { useState } from "react";
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

const userData = {
  name: "John Doe",
  email: "john.doe@company.com",
  avatar: "/avatar.png",
  plan: "PRO",
};

const apiKeys = [
  {
    id: 1,
    name: "Production Key",
    key: "hf_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    createdAt: "2024-01-10",
    lastUsed: "hace 5 min",
  },
  {
    id: 2,
    name: "Development Key",
    key: "hf_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    createdAt: "2024-01-08",
    lastUsed: "hace 2 horas",
  },
];

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
  const [name, setName] = useState(userData.name);
  const [email, setEmail] = useState(userData.email);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    toast.success("Perfil actualizado correctamente");
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-start gap-6">
        <Avatar className="w-16 h-16">
          <AvatarImage src={userData.avatar} />
          <AvatarFallback className="bg-violet-500/20 text-violet-400 text-lg font-medium">
            JD
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
          >
            Cambiar avatar
          </Button>
          <p className="text-[11px] text-gray-500">
            JPG, PNG o GIF. Máximo 2MB.
          </p>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs text-gray-400">
            Nombre
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/5 border-white/10 text-gray-200 focus:border-white/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs text-gray-400">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/5 border-white/10 text-gray-200 focus:border-white/20"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 text-white"
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
  const [showApiKey, setShowApiKey] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("API Key copiada al portapapeles");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateNewKey = () => {
    toast.promise(new Promise((r) => setTimeout(r, 1500)), {
      loading: "Generando nueva API Key...",
      success: "Nueva API Key generada: hf_live_new...",
      error: "Error al generar la API Key",
    });
  };

  return (
    <div className="space-y-4">
      {apiKeys.map((apiKey) => (
        <div
          key={apiKey.id}
          className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">{apiKey.name}</p>
              <p className="text-[11px] text-gray-500">
                Creada: {apiKey.createdAt} • Último uso: {apiKey.lastUsed}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setShowApiKey(showApiKey === apiKey.id ? null : apiKey.id)
                }
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                {showApiKey === apiKey.id ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                {copied === apiKey.id ? (
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <code className="block p-2 bg-gray-900/50 rounded text-xs font-mono text-gray-400">
            {showApiKey === apiKey.id
              ? apiKey.key
              : apiKey.key.slice(0, 12) + "•".repeat(24) + apiKey.key.slice(-4)}
          </code>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateNewKey}
        className="w-full bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
      >
        <Key className="w-3.5 h-3.5 mr-1.5" />
        Generar nueva API Key
      </Button>
    </div>
  );
}

function BillingSection() {
  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-violet-500/5 border border-violet-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-violet-500/10">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">
                Plan {userData.plan}
              </p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                Activo
              </span>
            </div>
            <p className="text-xs text-gray-500">
              $29/mes • Renovación: 15 Feb 2024
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
          asChild
        >
          <a href="/pricing">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Cambiar plan
          </a>
        </Button>
      </div>

      {/* Limits */}
      <div>
        <h4 className="text-[11px] font-medium tracking-widest text-gray-500 uppercase mb-3">
          Límites actuales
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { value: "5", label: "Proyectos" },
            { value: "10K", label: "Tests/mes" },
            { value: "500", label: "Curaciones/mes" },
            { value: "24/7", label: "Soporte" },
          ].map((item) => (
            <div key={item.label} className="text-center p-3 rounded-md bg-white/[0.02]">
              <p className="text-lg font-semibold text-white">{item.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Payment Method */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Método de pago</p>
          <p className="text-xs text-gray-500">•••• •••• •••• 4242</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
        >
          Actualizar
        </Button>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState({
    emailHealing: true,
    alerts: true,
    weekly: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success("Preferencias actualizadas");
  };

  return (
    <div className="space-y-4">
      {[
        {
          key: "emailHealing",
          title: "Email de autocuración",
          description: "Recibe un email cuando un test se autocure",
          checked: settings.emailHealing,
        },
        {
          key: "alerts",
          title: "Alertas de fallos",
          description: "Notificación cuando un test falle sin curación",
          checked: settings.alerts,
        },
        {
          key: "weekly",
          title: "Reporte semanal",
          description: "Resumen semanal de actividad",
          checked: settings.weekly,
        },
      ].map((item, i) => (
        <div key={item.key}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">{item.title}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <Switch
              checked={item.checked}
              onCheckedChange={() => toggleSetting(item.key as keyof typeof settings)}
            />
          </div>
          {i < 2 && <div className="h-px bg-white/5 mt-4" />}
        </div>
      ))}

      <div className="h-px bg-white/5" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Slack integration</p>
          <p className="text-xs text-gray-500">
            Enviar notificaciones a Slack
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
        >
          Conectar
        </Button>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("violet");

  const accents = [
    { id: "violet", color: "bg-violet-500" },
    { id: "blue", color: "bg-blue-500" },
    { id: "emerald", color: "bg-emerald-500" },
    { id: "amber", color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Tema</p>
          <p className="text-xs text-gray-500">
            Selecciona el tema de la aplicación
          </p>
        </div>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-32 bg-white/5 border-white/10 text-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1c] border-gray-800">
            <SelectItem value="light">Claro</SelectItem>
            <SelectItem value="dark">Oscuro</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-white/5" />

      {/* Accent Color */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Color de acento</p>
          <p className="text-xs text-gray-500">Color principal de la interfaz</p>
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
      <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <Github className="w-6 h-6 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-200">@johndoe</p>
            <p className="text-xs text-gray-500">Conectado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
            Sincronizado
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
          >
            Desconectar
          </Button>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
        <p className="text-sm text-gray-400">Más integraciones próximamente</p>
        <p className="text-xs text-gray-500 mt-1">
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
    <div className="flex gap-6">
      {/* Sidebar Tabs */}
      <div className="w-48 flex-shrink-0">
        <div className="sticky top-20 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-white/5 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="rounded-lg bg-[#111113] border border-white/5">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-base font-medium text-white">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          {/* Content */}
          <div className="p-6">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}