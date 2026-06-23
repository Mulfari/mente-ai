"use client";

import React from "react";
import { createPortal } from "react-dom";
import Logo from "@/components/Logo";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ProfileData = {
  status?: string;
  subscription_weeks?: number;
  subscription_start?: string;
  subscription_end?: string;
  used_coupon_label?: string;
  used_coupon_color?: string;
  last_message_at?: string;
  weekly_reset_at?: string;
} | null;

// Ancho expandido — usado solo por el sheet móvil; el ancho desktop vive en
// CSS (.sidebar-desktop en globals.css, 280/60px según data-sidebar).
const EXPANDED_W = 280;
const STORAGE_KEY = "vechat-sidebar-open";

// Etiquetas precisas tipo ChatGPT: ventanas de tiempo reales, no
// aproximaciones de calendario ("Este mes" era falso cruzando de mes).
function formatDateLabel(conv: Conversation): string {
  const dateStr =
    conv.updated_at && conv.updated_at !== conv.created_at
      ? conv.updated_at
      : conv.created_at;
  const d = new Date(dateStr || "");
  if (isNaN(d.getTime())) return "Más antiguo";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoy";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return "Últimos 7 días";
  if (diffDays < 30) return "Últimos 30 días";
  return "Más antiguo";
}

type Props = {
  conversations: Conversation[];
  activeConv: Conversation | null;
  userEmail: string;
  profile: ProfileData;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onRenameConv: (convId: string, title: string) => void;
  onShareConv: (conv: Conversation) => void;
  // false mientras la primera carga del historial está en vuelo — la lista
  // muestra un skeleton en vez del empty state (que sería mentira).
  conversationsLoaded?: boolean;
  // Paginación: hay más lotes por traer / se está trayendo uno / dispara el
  // siguiente (scroll infinito). Búsqueda al servidor (todo el historial).
  hasMoreConvs?: boolean;
  loadingMoreConvs?: boolean;
  onLoadMoreConvs?: () => void;
  onSearchConversations?: (q: string) => Promise<Conversation[]>;
  onNewConversation: () => void;
  onShowAccountMenu: () => void;
  // Mobile sheet
  showMobile: boolean;
  onCloseMobile: () => void;
  // Disabled (logged-out) state — fades the sidebar and blocks clicks
  disabled?: boolean;
  // Upsell de conversión (solo free): cuota del día + CTA a VeChat Plus.
  showUpgrade?: boolean;
  quotaUsed?: number;
  quotaTotal?: number;
  onUpgrade?: () => void;
};

function VeChatMark({ size = 20 }: { size?: number }) {
  // Marca VeChat (burbuja + V). Antes era solo la "V" stroke; ahora el logo real.
  return <Logo size={size} />;
}

function NewChatIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      style={{ color: "var(--text-tertiary)" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
      />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      style={{ transform: "rotate(180deg)" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

type RowProps = {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onShare: () => void;
  disabled: boolean;
  // Touch (mobile sheet): hover no existe, el kebab es siempre visible.
  alwaysShowDelete: boolean;
};

function ConversationRow({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onShare,
  disabled,
  alwaysShowDelete,
}: RowProps) {
  // Acciones por fila: un menú "⋮" (kebab) UNIFICADO en móvil y escritorio
  // (en escritorio aparece al hover; en móvil siempre, pero es UN solo ícono).
  // El menú abre Renombrar / Eliminar; el borrado confirma dentro del menú.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const kebabRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Renombrar inline: el título se vuelve input. Enter/blur guarda,
  // Escape cancela. Una sola salida (blur) para no guardar dos veces.
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(conv.title);
  const editInputRef = React.useRef<HTMLInputElement>(null);
  const cancelledRef = React.useRef(false);

  const openMenu = () => {
    const r = kebabRef.current?.getBoundingClientRect();
    if (!r) return;
    const MENU_W = 184;
    const MENU_H = 92;
    const left = Math.max(8, r.right - MENU_W);
    let top = r.bottom + 6;
    if (top + MENU_H > window.innerHeight - 8) top = r.top - MENU_H - 6; // flip arriba
    setMenuPos({ top, left });
    setConfirmDelete(false);
    setMenuOpen(true);
  };
  const closeMenu = React.useCallback(() => {
    setMenuOpen(false);
    setConfirmDelete(false);
  }, []);

  // Cerrar el menú al hacer click fuera, Escape, o scroll/resize.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || kebabRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuOpen, closeMenu]);

  const startEdit = () => {
    closeMenu();
    cancelledRef.current = false;
    setDraft(conv.title);
    setEditing(true);
  };

  React.useEffect(() => {
    if (editing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editing]);

  const finishEdit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== conv.title) onRename(trimmed);
  };

  return (
    <div
      role="button"
      tabIndex={disabled || editing ? -1 : 0}
      aria-current={isActive ? "true" : undefined}
      title={editing ? undefined : conv.title}
      onClick={disabled || editing ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled || editing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group relative w-full text-left rounded-lg cursor-pointer flex items-center gap-2 px-2.5 h-9 transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
      style={{
        backgroundColor: isActive ? "var(--surface-hover)" : undefined,
      }}
    >
      {isActive && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ backgroundColor: "var(--primary)" }}
        />
      )}
      {editing ? (
        <input
          ref={editInputRef}
          type="text"
          value={draft}
          maxLength={80}
          aria-label="Nuevo título de la conversación"
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelledRef.current = true;
              e.currentTarget.blur();
            }
          }}
          onBlur={finishEdit}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-medium rounded-md px-1.5 -mx-1.5 h-7"
          style={{
            color: "var(--text-primary)",
            boxShadow: "inset 0 0 0 1.5px var(--primary)",
          }}
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-[13.5px]"
          style={{
            // Legibilidad: los títulos van en el texto principal (espresso),
            // no en el gris apagado; el activo se distingue por peso + el
            // fondo y la barra de la izquierda, no por desteñir los demás.
            color: "var(--text-primary)",
            fontWeight: isActive ? 600 : 450,
          }}
        >
          {conv.title}
        </span>
      )}
      {!disabled && !editing && (
        <button
          ref={kebabRef}
          onClick={(e) => {
            e.stopPropagation();
            menuOpen ? closeMenu() : openMenu();
          }}
          aria-label={`Opciones de "${conv.title}"`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Opciones"
          className={`shrink-0 p-1 rounded-md transition-opacity duration-100 hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:opacity-100 ${
            alwaysShowDelete || menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
          style={{ color: "var(--text-tertiary)" }}
        >
          <KebabIcon />
        </button>
      )}

      {/* Menú vía portal: nunca lo recorta el scroll del sidebar. */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[100] rounded-xl py-1 animate-fade-in"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: 184,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            <>
              <p className="px-3 pt-1.5 pb-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                ¿Eliminar esta conversación?
              </p>
              <div className="flex items-center gap-1.5 px-2 pb-1">
                <button
                  role="menuitem"
                  onClick={() => { closeMenu(); onDelete(); }}
                  className="flex-1 py-1.5 rounded-lg text-[12.5px] font-medium text-white"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  Eliminar
                </button>
                <button
                  role="menuitem"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1.5 rounded-lg text-[12.5px] font-medium hover:bg-[var(--surface-hover)]"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => { closeMenu(); onShare(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span style={{ color: "var(--text-tertiary)" }}><ShareIcon /></span>
                Compartir
              </button>
              <button
                role="menuitem"
                onClick={startEdit}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span style={{ color: "var(--text-tertiary)" }}><EditIcon /></span>
                Renombrar
              </button>
              <button
                role="menuitem"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                style={{ color: "var(--danger)" }}
              >
                <DeleteIcon />
                Eliminar
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

type SidebarBodyProps = {
  conversations: Conversation[];
  activeConv: Conversation | null;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  userEmail: string;
  profile: ProfileData;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onRenameConv: (convId: string, title: string) => void;
  onShareConv: (conv: Conversation) => void;
  loaded: boolean;
  hasMoreConvs: boolean;
  loadingMoreConvs: boolean;
  onLoadMoreConvs?: () => void;
  onSearchConversations?: (q: string) => Promise<Conversation[]>;
  onNewConversation: () => void;
  onShowAccountMenu: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  disabled: boolean;
  variant: "desktop" | "mobile";
  showUpgrade: boolean;
  quotaUsed: number;
  quotaTotal: number;
  onUpgrade?: () => void;
};

// Skeleton del historial: barras con el ritmo visual de las filas reales
// (etiqueta de grupo + filas de 36px) mientras llega la primera carga.
function ConversationListSkeleton() {
  const widths = [78, 56, 68, 44, 62];
  return (
    <div className="pb-3" aria-hidden="true">
      <div className="px-2 pt-2 pb-1">
        <div
          className="h-2.5 w-14 rounded animate-pulse"
          style={{ backgroundColor: "var(--surface-hover)" }}
        />
      </div>
      <div className="space-y-0.5">
        {widths.map((w, i) => (
          <div key={i} className="flex items-center px-2.5 h-9">
            <div
              className="h-3 rounded animate-pulse"
              style={{
                width: `${w}%`,
                backgroundColor: "var(--surface-hover)",
                animationDelay: `${i * 120}ms`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarBody({
  conversations,
  activeConv,
  searchQuery,
  setSearchQuery,
  userEmail,
  profile,
  onSelectConv,
  onDeleteConv,
  onRenameConv,
  onShareConv,
  loaded,
  hasMoreConvs,
  loadingMoreConvs,
  onLoadMoreConvs,
  onSearchConversations,
  onNewConversation,
  onShowAccountMenu,
  expanded,
  onToggleExpanded,
  disabled,
  variant,
  showUpgrade,
  quotaUsed,
  quotaTotal,
  onUpgrade,
}: SidebarBodyProps) {
  // Agrupar el historial cargado por fecha (Hoy / Ayer / Últimos 7 / 30 días /
  // Más antiguas). La búsqueda NO filtra esto: va por separado al servidor.
  const grouped = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Conversation[]>();
    for (const conv of conversations) {
      const label = formatDateLabel(conv);
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(conv);
    }
    return { order, map };
  }, [conversations]);

  // Búsqueda al SERVIDOR (todo el historial, no solo lo cargado), con debounce.
  const isSearching = searchQuery.trim().length > 0;
  const [searchResults, setSearchResults] = React.useState<Conversation[] | null>(null);
  const [searchPending, setSearchPending] = React.useState(false);
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !onSearchConversations) { setSearchResults(null); setSearchPending(false); return; }
    setSearchPending(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await onSearchConversations(q);
      if (!cancelled) { setSearchResults(res); setSearchPending(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, onSearchConversations]);

  // Grupos plegables — estado recordado en localStorage por etiqueta.
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("vechat-sidebar-collapsed") : null;
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const toggleGroup = React.useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      try { localStorage.setItem("vechat-sidebar-collapsed", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Scroll infinito: al acercarse al final, pedir el siguiente lote.
  const navRef = React.useRef<HTMLElement>(null);
  const onNavScroll = React.useCallback(() => {
    const el = navRef.current;
    if (!el || isSearching || !hasMoreConvs || loadingMoreConvs) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) onLoadMoreConvs?.();
  }, [isSearching, hasMoreConvs, loadingMoreConvs, onLoadMoreConvs]);
  // Si el lote cargado no llena el área (pantalla alta), seguir trayendo
  // hasta llenar o agotar — si no, el usuario no podría disparar el scroll.
  // OJO: medir en rAF (tras el layout); en el primer render clientHeight es 0
  // y sin el guard `clientHeight > 0` el 0<=4 dispararía cargar TODO el historial.
  // OJO 2: si hay grupos COLAPSADOS, el contenido es chico A PROPÓSITO; NO
  // auto-cargar (si no, mediría "no llena" eternamente y traería todo el
  // historial a grupos ocultos, con el skeleton saliendo sin parar). El scroll
  // manual sigue paginando cuando sí hay para scrollear.
  React.useEffect(() => {
    if (!expanded || isSearching || !hasMoreConvs || loadingMoreConvs || collapsedGroups.size > 0) return;
    const id = requestAnimationFrame(() => {
      const el = navRef.current;
      if (el && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + 4) onLoadMoreConvs?.();
    });
    return () => cancelAnimationFrame(id);
  }, [conversations, expanded, isSearching, hasMoreConvs, loadingMoreConvs, onLoadMoreConvs, collapsedGroups]);

  const isMobile = variant === "mobile";
  const avatarLetter = (userEmail || "U").charAt(0).toUpperCase();
  const canInteract = !disabled;

  // Al expandir desde el icono de búsqueda del rail colapsado, el input
  // recibe el foco apenas existe — expandir sin foco dejaría el gesto a medias.
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const pendingSearchFocus = React.useRef(false);
  React.useEffect(() => {
    if (expanded && pendingSearchFocus.current) {
      pendingSearchFocus.current = false;
      searchInputRef.current?.focus();
    }
  }, [expanded]);

  const iconButtonClass =
    "p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]";
  const railButtonClass =
    "w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]";

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
        backdropFilter: "blur(40px)",
        borderRight: "1px solid var(--border)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {/* Top bar — brand + collapse (desktop) / brand + close X (mobile) */}
      <div
        className="h-14 flex items-center shrink-0"
        style={{ paddingLeft: expanded ? 16 : 0, paddingRight: expanded ? 12 : 0 }}
      >
        {expanded ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <VeChatMark size={18} />
              <span
                className="text-[15px] font-semibold tracking-tight whitespace-nowrap"
                style={{ color: "var(--text-primary)" }}
              >
                VeChat
              </span>
            </div>
            {canInteract && (
              <button
                onClick={onToggleExpanded}
                aria-label={isMobile ? "Cerrar menú" : "Colapsar sidebar"}
                title={isMobile ? "Cerrar" : "Colapsar"}
                className={`ml-auto ${iconButtonClass}`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {isMobile ? <CloseIcon /> : <CollapseIcon />}
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex justify-center">
            {/* Colapsado: el LOGO de VeChat arriba (clic = expandir en
                escritorio), como pidió el diseño. */}
            {!isMobile && canInteract ? (
              <button
                onClick={onToggleExpanded}
                aria-label="Expandir sidebar"
                title="Expandir"
                className="group relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                {/* En reposo el logo; al hover se transforma en ">" (señal de
                    expandir) con un cross-fade. */}
                <span className="transition-all duration-200 group-hover:opacity-0 group-hover:scale-90">
                  <VeChatMark size={28} />
                </span>
                <span
                  className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            ) : (
              <VeChatMark size={28} />
            )}
          </div>
        )}
      </div>

      {/* Actions: new chat + search */}
      <div className="shrink-0 space-y-1 px-2 pb-2">
        {expanded ? (
          <>
            <button
              onClick={onNewConversation}
              disabled={!canInteract}
              className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              style={{ color: "var(--text-primary)" }}
            >
              <NewChatIcon />
              <span className="truncate">Nuevo chat</span>
            </button>
            <div
              className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg"
              style={{ backgroundColor: "var(--surface-hover)" }}
            >
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                placeholder="Buscar..."
                aria-label="Buscar conversaciones"
                className="flex-1 min-w-0 outline-none bg-transparent text-[13px]"
                style={{ color: "var(--text-primary)" }}
                disabled={!canInteract}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="shrink-0 p-0.5 rounded hover:bg-[var(--surface)] transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <XSmallIcon />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onNewConversation}
              disabled={!canInteract}
              aria-label="Nuevo chat"
              title="Nuevo chat"
              className={railButtonClass}
              style={{ color: "var(--text-secondary)" }}
            >
              <NewChatIcon />
            </button>
            <button
              onClick={onToggleExpanded}
              disabled={!canInteract}
              aria-label="Conversaciones"
              title="Conversaciones"
              className={railButtonClass}
              style={{ color: "var(--text-secondary)" }}
            >
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l.9-3.6A7.86 7.86 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button
              onClick={() => {
                pendingSearchFocus.current = true;
                onToggleExpanded();
              }}
              disabled={!canInteract}
              aria-label="Buscar conversaciones"
              title="Buscar"
              className={railButtonClass}
              style={{ color: "var(--text-secondary)" }}
            >
              <SearchIcon />
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px shrink-0" style={{ backgroundColor: "var(--border)" }} />

      {/* Conversation list — only in expanded mode */}
      {expanded && (
        <nav
          ref={navRef}
          onScroll={onNavScroll}
          aria-label="Conversaciones"
          className="flex-1 overflow-y-auto px-1.5"
          style={{ touchAction: "pan-y" }}
        >
          {!loaded ? (
            <ConversationListSkeleton />
          ) : isSearching ? (
            // ── Búsqueda: resultados del servidor (TODO el historial) ──
            searchPending && searchResults === null ? (
              <div className="py-10 px-4 text-center">
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>Buscando…</p>
              </div>
            ) : (searchResults?.length ?? 0) === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-[13px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sin resultados</p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Prueba con otro término</p>
              </div>
            ) : (
              <div className="pb-3 pt-1 space-y-0.5">
                {searchResults!.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    isActive={activeConv?.id === conv.id}
                    onSelect={() => onSelectConv(conv)}
                    onDelete={() => onDeleteConv(conv.id)}
                    onRename={(title) => onRenameConv(conv.id, title)}
                    onShare={() => onShareConv(conv)}
                    disabled={disabled}
                    alwaysShowDelete={isMobile}
                  />
                ))}
              </div>
            )
          ) : conversations.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
              >
                <NewChatIcon />
              </div>
              <p className="text-[13px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Tu primera conversación
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                Escribe abajo para empezar
              </p>
            </div>
          ) : (
            <div className="pb-3">
              {grouped.order.map((label) => {
                const isCollapsed = collapsedGroups.has(label);
                const rows = grouped.map.get(label)!;
                return (
                  <div key={label} className="mb-1">
                    {/* Encabezado del grupo: plegable (recuerda el estado) */}
                    <button
                      onClick={() => toggleGroup(label)}
                      aria-expanded={!isCollapsed}
                      className="w-full flex items-center gap-1 px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide rounded-md transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <svg
                        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                        className="shrink-0 transition-transform duration-150"
                        style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", opacity: 0.7 }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      <span className="flex-1 text-left truncate">{label}</span>
                      <span className="text-[10px] tabular-nums font-medium" style={{ color: "var(--text-tertiary)" }}>
                        {rows.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {rows.map((conv) => (
                          <ConversationRow
                            key={conv.id}
                            conv={conv}
                            isActive={activeConv?.id === conv.id}
                            onSelect={() => onSelectConv(conv)}
                            onDelete={() => onDeleteConv(conv.id)}
                            onRename={(title) => onRenameConv(conv.id, title)}
                            onShare={() => onShareConv(conv)}
                            disabled={disabled}
                            alwaysShowDelete={isMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pie del scroll infinito: cargando / fin del historial */}
              {loadingMoreConvs && (
                <div className="space-y-0.5 pt-1 pb-3" role="status" aria-label="Cargando más conversaciones">
                  {[64, 48, 58].map((w, i) => (
                    <div key={i} className="flex items-center px-2.5 h-9" aria-hidden="true">
                      <div
                        className="h-3 rounded animate-pulse"
                        style={{ width: `${w}%`, backgroundColor: "var(--surface-hover)", animationDelay: `${i * 120}ms` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      )}

      {/* Spacer when collapsed — pushes the avatar to the bottom */}
      {!expanded && <div className="flex-1" />}

      {/* (Se quitó el cuadro de upsell "N de N mensajes hoy" del pie: el
          límite ahora lo comunica el chat con un mensaje al agotarse, y la
          etiqueta de plan vive en el chip de abajo.) */}

      {/* Account chip — avatar (estrella si Plus) + email + etiqueta de plan
          + caret ↑. Es el disparador del menú de cuenta (abre hacia arriba).
          showUpgrade === isFreeTier, así que lo usamos como señal de plan. */}
      <div className="shrink-0 px-2 pt-2 pb-3">
        {expanded ? (
          <button
            onClick={onShowAccountMenu}
            disabled={!canInteract}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[13px] transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <div
              className="relative w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 text-white"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
              }}
            >
              {avatarLetter}
              {!showUpgrade && (
                <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--warning)", border: "2px solid var(--background)" }}>
                  <svg className="w-2 h-2" fill="white" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left flex flex-col">
              <span
                className="truncate text-[13.5px] font-medium leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {userEmail || "Cuenta"}
              </span>
              {showUpgrade ? (
                <span className="text-[11.5px] leading-tight" style={{ color: "var(--text-tertiary)" }}>
                  Plan gratis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold leading-tight" style={{ color: "var(--primary)" }}>
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  VeChat Plus
                </span>
              )}
            </div>
            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={onShowAccountMenu}
              disabled={!canInteract}
              aria-label="Cuenta"
              title={userEmail || "Cuenta"}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer transition-opacity text-white focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                opacity: canInteract ? 1 : 0.6,
              }}
            >
              {avatarLetter}
              {!showUpgrade && (
                <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--warning)", border: "2px solid var(--background)" }}>
                  <svg className="w-2 h-2" fill="white" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConversationSidebar({
  conversations,
  activeConv,
  userEmail,
  profile,
  onSelectConv,
  onDeleteConv,
  onRenameConv,
  onShareConv,
  conversationsLoaded,
  hasMoreConvs,
  loadingMoreConvs,
  onLoadMoreConvs,
  onSearchConversations,
  onNewConversation,
  onShowAccountMenu,
  showMobile,
  onCloseMobile,
  disabled,
  showUpgrade,
  quotaUsed,
  quotaTotal,
  onUpgrade,
}: Props) {
  // La búsqueda es estado interno del sidebar — el resto de la app no la usa.
  const [searchQuery, setSearchQuery] = React.useState("");

  // ── Desktop: toggle explícito, persistido. Abierto por defecto (es la
  // navegación principal). El ANCHO no lo controla React: lo decide CSS via
  // el atributo data-sidebar de <html>, que un script en layout aplica antes
  // del primer paint — el espacio queda reservado desde el pixel uno y el
  // input del chat no brinca al hidratar. React solo decide el contenido
  // (rail vs. expandido) y sincroniza el atributo al hacer toggle.
  const [isOpen, setIsOpen] = React.useState(true);
  const didSyncRef = React.useRef(false);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setIsOpen(false);
    didSyncRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!didSyncRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, isOpen ? "true" : "false");
    } catch { /* storage bloqueado */ }
    document.documentElement.setAttribute("data-sidebar", isOpen ? "open" : "closed");
  }, [isOpen]);

  const expanded = isOpen;
  const onToggleExpanded = () => setIsOpen((cur) => !cur);

  // ── Mobile sheet ──
  const [hasOpened, setHasOpened] = React.useState(false);
  const [mobileSheetW, setMobileSheetW] = React.useState(EXPANDED_W);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setMobileSheetW(Math.min(EXPANDED_W, 0.92 * window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  React.useEffect(() => {
    if (showMobile) {
      setHasOpened(false);
      const id = requestAnimationFrame(() => setHasOpened(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showMobile]);

  // Escape cierra el sheet móvil.
  React.useEffect(() => {
    if (!showMobile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMobile, onCloseMobile]);

  return (
    <>
      {/* Desktop sidebar — el wrapper reserva el ancho (CSS, ver
          .sidebar-desktop); el panel interno entra deslizándose de
          izquierda a derecha sin mover el resto del layout. */}
      <div className="relative shrink-0 hidden md:block overflow-hidden sidebar-desktop">
        <div className="h-full sidebar-enter">
        <SidebarBody
          conversations={conversations}
          activeConv={activeConv}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          userEmail={userEmail}
          profile={profile}
          onSelectConv={onSelectConv}
          onDeleteConv={onDeleteConv}
          onRenameConv={onRenameConv}
          onShareConv={onShareConv}
          loaded={conversationsLoaded !== false}
          hasMoreConvs={!!hasMoreConvs}
          loadingMoreConvs={!!loadingMoreConvs}
          onLoadMoreConvs={onLoadMoreConvs}
          onSearchConversations={onSearchConversations}
          onNewConversation={onNewConversation}
          onShowAccountMenu={onShowAccountMenu}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          disabled={!!disabled}
          variant="desktop"
          showUpgrade={!!showUpgrade}
          quotaUsed={quotaUsed ?? 0}
          quotaTotal={quotaTotal ?? 0}
          onUpgrade={onUpgrade}
        />
        </div>
      </div>

      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        style={{
          opacity: showMobile ? 1 : 0,
          pointerEvents: showMobile ? "auto" : "none",
          transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* Mobile sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conversaciones"
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        style={{
          width: mobileSheetW,
          transform: hasOpened && showMobile ? "translateX(0)" : "translateX(-100%)",
          // Al cerrar, visibility pasa a hidden DESPUÉS del slide-out (0.32s)
          // para que el contenido fuera de pantalla no sea alcanzable por
          // teclado ni lectores. Al abrir, visible de inmediato.
          transition: showMobile
            ? "transform 0.32s cubic-bezier(0.2, 0, 0, 1)"
            : "transform 0.32s cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 0.32s",
          touchAction: "pan-y",
          visibility: showMobile ? "visible" : "hidden",
        }}
      >
        <SidebarBody
          conversations={conversations}
          activeConv={activeConv}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          userEmail={userEmail}
          profile={profile}
          onSelectConv={onSelectConv}
          onDeleteConv={onDeleteConv}
          onRenameConv={onRenameConv}
          onShareConv={onShareConv}
          loaded={conversationsLoaded !== false}
          hasMoreConvs={!!hasMoreConvs}
          loadingMoreConvs={!!loadingMoreConvs}
          onLoadMoreConvs={onLoadMoreConvs}
          onSearchConversations={onSearchConversations}
          onNewConversation={onNewConversation}
          onShowAccountMenu={onShowAccountMenu}
          expanded={true}
          onToggleExpanded={onCloseMobile}
          disabled={!!disabled}
          variant="mobile"
          showUpgrade={!!showUpgrade}
          quotaUsed={quotaUsed ?? 0}
          quotaTotal={quotaTotal ?? 0}
          onUpgrade={onUpgrade}
        />
      </div>
    </>
  );
}
