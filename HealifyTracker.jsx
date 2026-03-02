import { useState, useEffect } from "react";

const C = {
  bg:       "#07070A",
  surface:  "#0F0F13",
  panel:    "#141418",
  border:   "rgba(255,255,255,0.06)",
  borderHi: "rgba(255,255,255,0.12)",
  text1:    "#F0F0F4",
  text2:    "#8A8A9A",
  text3:    "#48485A",
  accent:   "#6366F1",
  accentLo: "rgba(99,102,241,0.14)",
  green:    "#34D399",
  greenLo:  "rgba(52,211,153,0.12)",
  amber:    "#FBBF24",
  amberLo:  "rgba(251,191,36,0.12)",
  red:      "#F87171",
  redLo:    "rgba(248,113,113,0.12)",
  blue:     "#60A5FA",
  blueLo:   "rgba(96,165,250,0.12)",
  violet:   "#A78BFA",
  violetLo: "rgba(167,139,250,0.12)",
};

const ROADMAP = [
  {
    id:"infra", label:"Infraestructura", emoji:"🏗", accent:C.red, accentLo:C.redLo,
    tasks:[
      { id:"i1", label:"Fix build Vercel (finishedAt)",         pct:100, status:"done",   hasPrompt:false, note:"Columna finishedAt agregada al CSV export. Pusheado y deployado en Vercel." },
      { id:"i2", label:"157/157 tests · 0 errores TypeScript",  pct:100, status:"done",   hasPrompt:false, note:"Verificado en local. Verde." },
      { id:"i3", label:"Redis cache analytics (5 min TTL)",     pct:100, status:"done",   hasPrompt:false, note:"Cache en /api/analytics y /api/analytics/files." },
      { id:"i4", label:"Structured logger JSON",                pct:100, status:"done",   hasPrompt:false, note:"Silent en tests, JSON estructurado en producción." },
      { id:"i5", label:"ANTHROPIC_API_KEY en Vercel",           pct:0,   status:"manual", hasPrompt:false, note:"console.anthropic.com → API Keys → pegar en Vercel Environment Variables." },
      { id:"i6", label:"Dominio healify.dev",                   pct:0,   status:"manual", hasPrompt:false, note:"~$10/año en cloudflare.com/registrar." },
    ],
  },
  {
    id:"core", label:"Core AI & Backend", emoji:"⚡", accent:C.green, accentLo:C.greenLo,
    tasks:[
      { id:"c1", label:"AI Healing con Claude Sonnet",          pct:100, status:"done",   hasPrompt:false, note:"Fallback determinístico si no hay API key configurada." },
      { id:"c2", label:"Auto-PR en GitHub con diff comentado",  pct:100, status:"done",   hasPrompt:false, note:"PR automático + comentario con selector viejo → nuevo." },
      { id:"c3", label:"SDK Playwright / Cypress / Jest",       pct:100, status:"done",   hasPrompt:false, note:"npm install @healify/playwright-sdk — 3 líneas de config." },
      { id:"c4", label:"Queue BullMQ + Worker en Railway",      pct:100, status:"done",   hasPrompt:false, note:"Dead letter queue + retry automático integrado." },
      { id:"c5", label:"Webhook GitHub HMAC-SHA256",            pct:100, status:"done",   hasPrompt:false, note:"Verificación de firma en todos los endpoints de webhook." },
      { id:"c6", label:"Notificaciones Email + Slack + in-app", pct:100, status:"done",   hasPrompt:false, note:"Resend + Slack Webhook + bell con contador de no leídos." },
      { id:"c7", label:"Export CSV / JSON de test runs",        pct:100, status:"done",   hasPrompt:false, note:"GET /api/test-runs/export — afectado por el fix finishedAt." },
      { id:"c8", label:"Rate limiting por API key",             pct:100, status:"done",   hasPrompt:false, note:"60 req/min. Límites por plan en DB: pendiente." },
    ],
  },
  {
    id:"payments", label:"Monetización", emoji:"💳", accent:C.violet, accentLo:C.violetLo,
    tasks:[
      { id:"p1", label:"Stripe — código integrado",             pct:100, status:"done",   hasPrompt:false, note:"Checkout + webhook + portal del cliente funcionando." },
      { id:"p2", label:"MercadoPago — código integrado (ARS)",  pct:100, status:"done",   hasPrompt:false, note:"Preapproval API recurrente + webhook HMAC." },
      { id:"p3", label:"Lemon Squeezy — código integrado (USD)",pct:100, status:"done",   hasPrompt:false, note:"Merchant of record — maneja IVA internacional automáticamente." },
      { id:"p4", label:"Activar MercadoPago en producción",     pct:0,   status:"manual", hasPrompt:false, note:"1. mercadopago.com.ar/developers → crear planes recurrentes\n2. Vercel → MP_ACCESS_TOKEN + MP_PRO_PLAN_ID + MP_STARTER_PLAN_ID" },
      { id:"p5", label:"Activar Lemon Squeezy en producción",   pct:0,   status:"manual", hasPrompt:false, note:"1. app.lemonsqueezy.com → crear variantes de producto\n2. Vercel → LEMONSQUEEZY_API_KEY + LEMONSQUEEZY_STORE_ID + LS_PRO_VARIANT_ID" },
      { id:"p6", label:"Límites reales por plan en base de datos",pct:0, status:"manual", hasPrompt:false, note:"Asignado a tu lado. Conectar rate limiting a tabla Subscription (hoy hardcodeado)." },
      { id:"p7", label:"Weekly email report automático",         pct:0,   status:"manual", hasPrompt:false, note:"Asignado a tu lado. Cron job lunes 8am con resumen de tests curados + ROI + tendencia." },
      { id:"p8", label:"GitHub badge 'Healed by Healify'",      pct:0,   status:"manual", hasPrompt:false, note:"Asignado a tu lado. Endpoint SVG dinámico en /api/badge/[projectId] para README." },
    ],
  },
  {
    id:"dashboard", label:"Dashboard & UX", emoji:"📊", accent:C.blue, accentLo:C.blueLo,
    tasks:[
      { id:"d1", label:"KPIs + ROI strip + gráfico 7 días",    pct:100, status:"done",   hasPrompt:false, note:"4 metric cards + tendencia de curación con Recharts." },
      { id:"d2", label:"Filtros fecha / status / branch",       pct:100, status:"done",   hasPrompt:false, note:"Siempre / Hoy / 7d / 30d + custom range en Tests." },
      { id:"d3", label:"Flaky badge 🔥 en tests",              pct:100, status:"done",   hasPrompt:false, note:"Detecta alternancia PASS/FAIL en últimos 5 runs." },
      { id:"d4", label:"Selector History Timeline",             pct:100, status:"done",   hasPrompt:false, note:"/dashboard/selectors con trend badge, diff visual y filtros." },
      { id:"d5", label:"Stats por archivo de test",             pct:100, status:"done",   hasPrompt:false, note:"GET /api/analytics/files — top 5 archivos más inestables." },
      { id:"d6", label:"Dashboard con TABS (3 vistas)",         pct:100, status:"done",   hasPrompt:false, note:"3 tabs con iconos: Overview (BarChart3) / Análisis (TrendingUp) / Funciones (Wrench)." },
      { id:"d7", label:"Empty state inteligente",               pct:100, status:"done",   hasPrompt:false, note:"Dual variant (inline/full). Full muestra guía 3 pasos: Crear proyecto → Instalar SDK → Ver curaciones." },
      { id:"d8", label:"Quick search global en header",         pct:100, status:"done",   hasPrompt:false, note:"Ctrl+K con accesos rápidos, búsquedas recientes (localStorage), badges de status, hints de teclado." },
      { id:"d9", label:"Estado de salud por proyecto en sidebar",pct:100, status:"done",   hasPrompt:false, note:"SidebarProjectHealth.tsx — top 5 proyectos con dot verde/amarillo/rojo. Ya existía funcional." },
    ],
  },
  {
    id:"design", label:"Design System", emoji:"🎨", accent:C.accent, accentLo:C.accentLo,
    tasks:[
      { id:"u1", label:"Prompt v1 — Linear style entregado",   pct:100, status:"done",   hasPrompt:false, note:"Design tokens completos + instrucciones por componente." },
      { id:"u2", label:"Prompt v2 — AMOLED dark entregado",    pct:100, status:"done",   hasPrompt:false, note:"Fix glassmorphism, fuentes Orbitron/JetBrains Mono, fondo azul." },
      { id:"u3", label:"Ejecutar Prompt v2 en Claude Code",    pct:100, status:"done",   hasPrompt:false, note:"AMOLED aplicado: #000000 backgrounds, glass-elite-hover, amoled-card/amoled-glow utilities, backdrop-blur headers." },
      { id:"u4", label:"Dashboard tabs + widgets layout",      pct:100, status:"done",   hasPrompt:false, note:"Funciones tab rediseñado: progress bar activación, quick actions grid (3 cards), SDK Quick Start con code blocks." },
      { id:"u5", label:"Docs page rediseño",                   pct:100, status:"done",   hasPrompt:false, note:"Hero con badges Playwright/Cypress/Jest/Selenium, TOC sidebar con borde accent + CTA ayuda, glow decorativo." },
    ],
  },
  {
    id:"demo", label:"Demo & Onboarding", emoji:"🚀", accent:C.amber, accentLo:C.amberLo,
    tasks:[
      { id:"o1", label:"Demo en vivo desde OnboardingBanner",  pct:100, status:"done",   hasPrompt:false, note:"Botón 'Ver demo en vivo' → POST /api/demo/run → resultado real." },
      { id:"o2", label:"Demo pública animada en landing",       pct:100, status:"done",   hasPrompt:false, note:"HealingDemo loop 7s con 3 escenarios ya público en landing. Callout 'Demo pública — sin registro requerido' agregado." },
      { id:"o3", label:"Sandbox con proyecto pre-cargado",      pct:100, status:"done",   hasPrompt:false, note:"POST /api/demo/sandbox crea proyecto con 5 test runs (HEALED/PASSED/FAILED) + 5 healing events en 3 días." },
      { id:"o4", label:"Onboarding 3 pasos con barra de progreso",pct:100, status:"done", hasPrompt:false, note:"Progress bar con % + 3 step indicators (verde/púrpura) integrado en pestaña Funciones del dashboard." },
      { id:"o5", label:"Video demo 90s embebido",               pct:50,  status:"ready",  hasPrompt:false, note:"VideoDemoSection creado con placeholder 16:9 + botón play + stats bar. Falta grabar video real con Loom/ScreenStudio." },
    ],
  },
];

const STATUS_CFG = {
  done:    { label:"Completado", color:C.green,  bg:C.greenLo  },
  ready:   { label:"En push",   color:C.amber,  bg:C.amberLo  },
  pending: { label:"Pendiente", color:C.accent, bg:C.accentLo },
  manual:  { label:"Manual",    color:C.text3,  bg:"rgba(255,255,255,0.05)" },
};

const URGENT = [
  { icon:"�", tag:"URGENTE",    tagColor:C.red,    label:"ANTHROPIC_API_KEY en Vercel",
    detail:"1. Ir a console.anthropic.com → API Keys\n2. Crear nueva key → copiar sk-ant-api03-...\n3. Vercel Dashboard → Settings → Environment Variables\n4. Agregar ANTHROPIC_API_KEY = sk-ant-api03-..." },
  { icon:"💳", tag:"ESTA SEMANA",tagColor:C.violet, label:"Activar MercadoPago en producción",
    detail:"1. mercadopago.com.ar/developers → Tus integraciones\n2. Crear plan recurrente Starter ($4900 ARS), Pro ($9900), Enterprise ($19900)\n3. Vercel → MP_ACCESS_TOKEN + MP_STARTER_PLAN_ID + MP_PRO_PLAN_ID + MP_ENTERPRISE_PLAN_ID" },
  { icon:"🌍", tag:"ESTA SEMANA",tagColor:C.violet, label:"Activar Lemon Squeezy en producción",
    detail:"1. app.lemonsqueezy.com → Products → crear variantes\n2. Starter ($29 USD), Pro ($59), Enterprise ($99)\n3. Vercel → LEMONSQUEEZY_API_KEY + LEMONSQUEEZY_STORE_ID + LS_STARTER/PRO/ENTERPRISE_VARIANT_ID" },
  { icon:"🎬", tag:"ESTA SEMANA",tagColor:C.amber,  label:"Grabar video demo 90s",
    detail:"1. Abrir Loom o ScreenStudio\n2. Grabar flujo: test falla → Healify detecta → PR abierto\n3. Pegar URL en VideoDemoSection de src/app/page.tsx (reemplazar placeholder)" },
  { icon:"📊", tag:"PRÓXIMO",    tagColor:C.accent, label:"Límites por plan + Weekly report + Badge",
    detail:"p6: Conectar rate limiting a tabla Subscription\np7: Cron job lunes 8am con resumen semanal\np8: SVG dinámico en /api/badge/[projectId]" },
];

/* ── helpers ── */
function sectionPct(tasks) {
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((a,t) => a+t.pct, 0) / tasks.length);
}
function totalPct() {
  const all = ROADMAP.flatMap(s=>s.tasks);
  return Math.round(all.reduce((a,t)=>a+t.pct,0)/all.length);
}

/* ── CircleProgress ── */
function CircleProgress({ pct, size=50, stroke=3, color, label }) {
  const r = (size - stroke*2)/2;
  const circ = 2*Math.PI*r;
  const dash = circ - (pct/100)*circ;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", position:"absolute", inset:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
          style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {label}
      </div>
    </div>
  );
}

/* ── ThinBar ── */
function ThinBar({ pct, color }) {
  return (
    <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99,
        transition:"width 1.2s cubic-bezier(.22,1,.36,1)",
        boxShadow: pct>0 ? `0 0 8px ${color}55` : "none" }}/>
    </div>
  );
}

/* ── Chip ── */
function Chip({ children, color, bg, xs }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", lineHeight:1.4,
      padding: xs ? "2px 5px" : "3px 8px",
      borderRadius:4, fontSize: xs ? 9.5 : 11,
      fontWeight:600, letterSpacing:"0.025em",
      color, background:bg, whiteSpace:"nowrap",
    }}>{children}</span>
  );
}

/* ── TaskRow ── */
function TaskRow({ task, accent, last }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CFG[task.status];
  const dotColor = task.pct===100 ? C.green : task.pct>0 ? C.amber : cfg.color;
  return (
    <div onClick={()=>setOpen(v=>!v)} style={{
      display:"flex", alignItems:"flex-start", gap:10,
      padding:"9px 16px 9px 44px",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.035)",
      cursor:"pointer", transition:"background 0.12s",
    }}
      onMouseEnter={e=>{ if(!open) e.currentTarget.style.background="rgba(255,255,255,0.018)"; }}
      onMouseLeave={e=>{ if(!open) e.currentTarget.style.background="transparent"; }}
    >
      <div style={{ width:6, height:6, borderRadius:"50%", background:dotColor,
        flexShrink:0, marginTop:5,
        boxShadow: task.pct===100 ? `0 0 6px ${C.green}80` : "none" }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{
            fontSize:12.5, fontWeight: task.pct===100 ? 400 : 500,
            color: task.pct===100 ? C.text2 : C.text1,
            textDecoration: task.pct===100 ? "line-through" : "none",
            textDecorationColor: C.text3,
          }}>{task.label}</span>
          {task.hasPrompt && <Chip color={accent} bg={`${accent}1A`} xs>PROMPT LISTO</Chip>}
        </div>
        {open && task.note && (
          <pre style={{
            fontSize:11, color:C.text2, marginTop:5, lineHeight:1.65,
            fontFamily:"'Fira Code','Courier New',monospace",
            whiteSpace:"pre-wrap", background:"rgba(0,0,0,0.28)",
            padding:"7px 10px", borderRadius:6,
            borderLeft:`2px solid ${accent}`,
          }}>{task.note}</pre>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, marginTop:1 }}>
        <span style={{ fontSize:11, fontWeight:700, color:cfg.color, minWidth:24, textAlign:"right" }}>
          {task.pct}%
        </span>
        <Chip color={cfg.color} bg={cfg.bg} xs>{cfg.label}</Chip>
        <span style={{ fontSize:10, color:C.text3,
          transform:open?"rotate(90deg)":"rotate(0deg)", transition:"transform 0.18s" }}>›</span>
      </div>
    </div>
  );
}

/* ── SectionCard ── */
function SectionCard({ section, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = sectionPct(section.tasks);
  const done = section.tasks.filter(t=>t.status==="done").length;
  const prompts = section.tasks.filter(t=>t.hasPrompt).length;
  return (
    <div style={{
      background:C.surface, borderRadius:10, overflow:"hidden", marginBottom:6,
      border:`1px solid ${open ? C.borderHi : C.border}`,
      boxShadow: open ? "0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
      transition:"border-color 0.2s, box-shadow 0.2s",
    }}>
      <button onClick={()=>setOpen(v=>!v)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:14,
        padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left",
      }}>
        <CircleProgress pct={pct} size={48} stroke={3} color={section.accent}
          label={<span style={{ fontSize:16 }}>{section.emoji}</span>}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:5 }}>
            <span style={{ fontSize:13.5, fontWeight:700, color:C.text1 }}>{section.label}</span>
            <span style={{ fontSize:12, fontWeight:800, color:section.accent }}>{pct}%</span>
            <span style={{ fontSize:11, color:C.text3 }}>{done}/{section.tasks.length}</span>
            {prompts>0 && <span style={{ fontSize:10, color:section.accent }}>{prompts} prompts ›</span>}
          </div>
          <ThinBar pct={pct} color={section.accent}/>
        </div>
        <div style={{
          width:26, height:26, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
          background:open?"rgba(255,255,255,0.06)":"transparent", transition:"all 0.2s",
        }}>
          <span style={{ fontSize:10, color:C.text3,
            transform:open?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", display:"block" }}>▼</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop:`1px solid ${C.border}` }}>
          {section.tasks.map((task,i)=>(
            <TaskRow key={task.id} task={task} accent={section.accent} last={i===section.tasks.length-1}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── UrgencyPanel ── */
function UrgencyPanel() {
  const [expanded, setExpanded] = useState(null);
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", marginBottom:20 }}>
      <div style={{ padding:"11px 16px", borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>⚡ Acciones prioritarias</span>
        <span style={{ fontSize:11, color:C.text3 }}>hacelas en este orden</span>
      </div>
      {URGENT.map((item,i)=>(
        <button key={i} onClick={()=>setExpanded(expanded===i?null:i)} style={{
          width:"100%", display:"flex", alignItems:"flex-start", gap:10,
          padding:"10px 16px",
          background:expanded===i?"rgba(255,255,255,0.025)":"transparent",
          border:"none", borderBottom:i<URGENT.length-1?`1px solid ${C.border}`:"none",
          cursor:"pointer", textAlign:"left", transition:"background 0.12s",
        }}>
          <span style={{ fontSize:13, marginTop:1, flexShrink:0 }}>{item.icon}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:12.5, color:C.text1, fontWeight:500 }}>{item.label}</span>
            {expanded===i && (
              <pre style={{
                fontSize:11, color:C.text2, marginTop:5, lineHeight:1.7,
                fontFamily:"'Fira Code','Courier New',monospace", whiteSpace:"pre-wrap",
                background:"rgba(0,0,0,0.3)", padding:"8px 10px", borderRadius:6,
                borderLeft:`2px solid ${item.tagColor}`,
              }}>{item.detail}</pre>
            )}
          </div>
          <Chip color={item.tagColor} bg={`${item.tagColor}18`} xs>{item.tag}</Chip>
        </button>
      ))}
    </div>
  );
}

/* ── MAIN ── */
export default function HealifyTracker() {
  const [filter, setFilter] = useState("all");
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setMounted(true),60); return()=>clearTimeout(t); },[]);

  const total = totalPct();
  const all = ROADMAP.flatMap(s=>s.tasks);
  const counts = {
    done:    all.filter(t=>t.status==="done").length,
    pending: all.filter(t=>t.status==="pending").length,
    ready:   all.filter(t=>t.status==="ready").length,
    prompt:  all.filter(t=>t.hasPrompt).length,
    manual:  all.filter(t=>t.status==="manual").length,
    total:   all.length,
  };

  const FILTERS = [
    { id:"all",    label:"Todo",       count:null },
    { id:"pending",label:"Pendiente",  count:counts.pending },
    { id:"prompt", label:"Con Prompt", count:counts.prompt  },
    { id:"ready",  label:"En push",    count:counts.ready   },
    { id:"done",   label:"Completado", count:counts.done    },
    { id:"manual", label:"Manual",     count:counts.manual  },
  ];

  const filtered = ROADMAP.map(s=>({
    ...s,
    tasks: filter==="all"    ? s.tasks
         : filter==="prompt" ? s.tasks.filter(t=>t.hasPrompt)
         : filter==="manual" ? s.tasks.filter(t=>t.status==="manual")
         : s.tasks.filter(t=>t.status===filter),
  })).filter(s=>s.tasks.length>0);

  const fadeUp = (delay=0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.45s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.45s cubic-bezier(.22,1,.36,1) ${delay}s`,
  });

  return (
    <div style={{
      minHeight:"100vh", background:C.bg, color:C.text1,
      fontFamily:"'DM Sans','Outfit',-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      {/* NAV */}
      <nav style={{
        position:"sticky", top:0, zIndex:20,
        background:`${C.bg}E6`, backdropFilter:"blur(18px)",
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 24px", height:52,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:26, height:26, borderRadius:7, fontSize:13,
            background:`linear-gradient(135deg, ${C.accent}, #818CF8)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 0 14px ${C.accent}44`,
          }}>⚡</div>
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:"-0.015em" }}>Healify</span>
          <span style={{ fontSize:11, color:C.text3, paddingLeft:8,
            borderLeft:`1px solid ${C.border}`, marginLeft:4 }}>Project Tracker</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <CircleProgress pct={total} size={34} stroke={2.5} color={C.accent}
            label={<span style={{ fontSize:8, fontWeight:900, color:C.accent }}>{total}%</span>}/>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.accent }}>{total}% completo</div>
            <div style={{ fontSize:10, color:C.text3 }}>{counts.done}/{counts.total} items</div>
          </div>
        </div>
      </nav>

      {/* PROGRESS LINE */}
      <div style={{ height:2, background:"rgba(255,255,255,0.04)" }}>
        <div style={{
          height:"100%", width:`${mounted?total:0}%`,
          background:`linear-gradient(90deg, ${C.accent}, #818CF8)`,
          transition:"width 1.4s cubic-bezier(.22,1,.36,1) 0.1s",
          boxShadow:`0 0 10px ${C.accent}66`,
        }}/>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"24px 16px 64px" }}>

        {/* STAT CARDS */}
        <div style={{ ...fadeUp(0), display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          gap:1, background:C.border, borderRadius:10, overflow:"hidden", marginBottom:22 }}>
          {[
            { v:counts.done,    l:"Completados", c:C.green  },
            { v:counts.pending, l:"Pendientes",  c:C.accent },
            { v:counts.prompt,  l:"Con Prompt",  c:C.violet },
            { v:counts.manual,  l:"Manuales",    c:C.text3  },
          ].map((s,i)=>(
            <div key={i} style={{ background:C.surface, padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:900, color:s.c, lineHeight:1,
                fontVariantNumeric:"tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize:10, color:C.text3, marginTop:3,
                textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* URGENCY */}
        <div style={fadeUp(0.07)}><UrgencyPanel/></div>

        {/* FILTER TABS */}
        <div style={{ ...fadeUp(0.13), display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
          {FILTERS.map(f=>{
            const active = filter===f.id;
            return (
              <button key={f.id} onClick={()=>setFilter(f.id)} style={{
                padding:"5px 12px", borderRadius:6, fontSize:12,
                fontWeight:active?600:500, cursor:"pointer", transition:"all 0.15s",
                border:`1px solid ${active?`${C.accent}55`:C.border}`,
                background:active?C.accentLo:"transparent",
                color:active?C.accent:C.text2,
              }}>
                {f.label}
                {f.count!=null && f.count>0 && (
                  <span style={{ marginLeft:5, fontSize:10, color:active?C.accent:C.text3 }}>{f.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* LEGEND */}
        <div style={{ ...fadeUp(0.17), display:"flex", gap:14, flexWrap:"wrap", marginBottom:16 }}>
          {Object.entries(STATUS_CFG).map(([k,v])=>(
            <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:v.color }}/>
              <span style={{ fontSize:11, color:C.text3 }}>{v.label}</span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Chip color={C.accent} bg={C.accentLo} xs>PROMPT LISTO</Chip>
            <span style={{ fontSize:11, color:C.text3 }}>= tiene prompt para Claude Code</span>
          </div>
        </div>

        {/* SECTIONS */}
        <div style={fadeUp(0.2)}>
          {filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:C.text3, fontSize:13 }}>
              No hay ítems con ese filtro.
            </div>
          ) : filtered.map((s,i)=>(
            <SectionCard key={s.id} section={s} defaultOpen={i===0 && filter==="all"}/>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{
          ...fadeUp(0.28),
          marginTop:32, paddingTop:18,
          borderTop:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap:8,
        }}>
          <span style={{ fontSize:11, color:C.text3 }}>
            Healify v0.3.0 · 157/157 tests · 0 errores TypeScript · Deploy Vercel ✓
          </span>
          <span style={{ fontSize:11, color:C.text3 }}>Marzo 2026</span>
        </div>
      </div>
    </div>
  );
}
