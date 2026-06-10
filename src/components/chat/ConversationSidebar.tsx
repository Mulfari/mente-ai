"use client";

import React from "react";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ProfileData = {
  status?: string;
  subscription_weeks?: number;
  // Other fields kept for type compat with parent, but unused in this component.
  subscription_start?: string;
  subscription_end?: string;
  used_coupon_label?: string;
  used_coupon_color?: string;
  last_message_at?: string;
  weekly_reset_at?: string;
} | null;

const COLLAPSED_W = 60;
const EXPANDED_W = 280;
const WIDTH_TRANSITION = "width 0.28s cubic-bezier(0.2, 0, 0, 1)";

function formatDateLabel(conv: Conversation): string {
  const dateStr =
    conv.updated_at && conv.updated_at !== conv.created_at
      ? conv.updated_at
      : conv.created_at;
  const d = new Date(dateStr || "");
  const now = new Date();
  if (isNaN(d.getTime())) return "";
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (isToday) return "Hoy";
  if (isYesterday) return "Ayer";
  if (diffDays > 1 && diffDays < 7) return "Esta semana";
  if (diffDays >= 7 && diffDays < 30) return "Este mes";
  return "Más antiguo";
}

type Props = {
  conversations: Conversation[];
  activeConv: Conversation | null;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  userEmail: string;
  profile: ProfileData;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onNewConversation: () => void;
  onShowAccountMenu: () => void;
  // Mobile sheet
  showMobile: boolean;
  onCloseMobile: () => void;
  // Disabled (logged-out) state — fades the sidebar and blocks clicks
  disabled?: boolean;
};

function VeChatMark({ size = 16 }: { size?: number }) {
  // Minimal "V" mark — single stroke, no gradient square.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--primary)" }}
    >
      <path d="M4 5l8 14L20 5" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  // Chevron that flips: collapsed → points right, expanded → points left.
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      style={{
        transition: "transform 0.2s ease",
        transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function CollapseExpandIcon({ expanded }: { expanded: boolean }) {
  // Same chevron, opposite direction. Used as the "force expand" affordance
  // when the sidebar is collapsed.
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      style={{
        transition: "transform 0.2s ease",
        transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

type RowProps = {
  conv: Conversation;
  isActive: boolean;
  visible: boolean;
  onSelect: () => void;
  onDelete: () => void;
  disabled: boolean;
};

function ConversationRow({
  conv,
  isActive,
  visible,
  onSelect,
  onDelete,
  disabled,
}: RowProps) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative w-full text-left rounded-lg cursor-pointer flex items-center gap-2 px-2.5 py-2 transition-colors duration-150"
      style={{
        backgroundColor:
          isActive || (hovered && !disabled)
            ? "var(--surface-hover)"
            : "transparent",
        opacity: visible ? 1 : 0,
        height: visible ? 36 : 0,
        overflow: "hidden",
        transition:
          "background-color 0.15s ease, opacity 0.2s ease, height 0.2s ease",
      }}
    >
      {isActive && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ backgroundColor: "var(--primary)" }}
        />
      )}
      <span
        className="flex-1 min-w-0 truncate text-[13px] font-medium"
        style={{
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        {conv.title}
      </span>
      {!disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Eliminar conversacion"
          className="shrink-0 p-1 rounded-md transition-opacity duration-100"
          style={{
            color: hovered ? "var(--danger)" : "var(--text-tertiary)",
            backgroundColor: hovered
              ? "color-mix(in srgb, var(--danger) 12%, transparent)"
              : "transparent",
            opacity: hovered ? 1 : 0,
          }}
        >
          <DeleteIcon />
        </button>
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
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onNewConversation: () => void;
  onShowAccountMenu: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  disabled: boolean;
  // Optional: how the collapse/expand affordance should look.
  // "desktop" → chevron that collapses the sidebar (when expanded) or expands it (when collapsed)
  // "mobile"  → no affordance; the sheet is always open while visible
  variant: "desktop" | "mobile";
};

function SidebarBody({
  conversations,
  activeConv,
  searchQuery,
  setSearchQuery,
  userEmail,
  onSelectConv,
  onDeleteConv,
  onNewConversation,
  onShowAccountMenu,
  expanded,
  onToggleExpanded,
  disabled,
  variant,
}: SidebarBodyProps) {
  // Group conversations by their date label so we can show section headers.
  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const grouped = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Conversation[]>();
    for (const conv of filtered) {
      const label = formatDateLabel(conv) || "Más antiguo";
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(conv);
    }
    return { order, map };
  }, [filtered]);

  const isMobile = variant === "mobile";
  // Hide labels and helper text when collapsed. Sections still take space
  // because rows themselves stay visible (just truncated).
  const showLabels = expanded;
  const avatarLetter = (userEmail || "U").charAt(0).toUpperCase();
  const canInteract = !disabled;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--surface) 96%, transparent)",
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
            {isMobile ? (
              canInteract && (
                <button
                  onClick={onToggleExpanded}
                  aria-label="Cerrar menu"
                  title="Cerrar"
                  className="ml-auto p-1.5 rounded-lg transition-colors duration-150"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <CloseIcon />
                </button>
              )
            ) : (
              canInteract && (
                <button
                  onClick={onToggleExpanded}
                  aria-label="Colapsar sidebar"
                  title="Colapsar"
                  className="ml-auto p-1.5 rounded-lg transition-colors duration-150"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <CollapseIcon collapsed={false} />
                </button>
              )
            )}
          </>
        ) : (
          <div className="w-full flex justify-center">
            {!isMobile && canInteract ? (
              <button
                onClick={onToggleExpanded}
                aria-label="Expandir sidebar"
                title="Expandir"
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "transparent";
                }}
              >
                <CollapseExpandIcon expanded={false} />
              </button>
            ) : (
              <VeChatMark size={18} />
            )}
          </div>
        )}
      </div>

      {/* Actions: new chat + search */}
      <div
        className="shrink-0 space-y-1"
        style={{ padding: expanded ? "0 8px 8px" : "0 8px 8px" }}
      >
        {expanded ? (
          <>
            {/* "+ Nuevo chat" — primary action. Subtle border + filled-on-hover
                so it reads as a button, not a row. */}
            <button
              onClick={onNewConversation}
              disabled={!canInteract}
              className="group w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150"
              style={{
                color: "var(--text-primary)",
                backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 18%, transparent)",
              }}
              onMouseEnter={(e) => {
                if (!canInteract) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.backgroundColor =
                  "color-mix(in srgb, var(--primary) 18%, transparent)";
                el.style.borderColor =
                  "color-mix(in srgb, var(--primary) 32%, transparent)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.backgroundColor =
                  "color-mix(in srgb, var(--primary) 8%, transparent)";
                el.style.borderColor =
                  "color-mix(in srgb, var(--primary) 18%, transparent)";
              }}
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 min-w-0 outline-none bg-transparent text-[13px]"
                style={{ color: "var(--text-primary)" }}
                disabled={!canInteract}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onNewConversation}
              disabled={!canInteract}
              aria-label="Nuevo chat"
              title="Nuevo chat"
              className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                if (!canInteract) return;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--surface-hover)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
              }}
            >
              <NewChatIcon />
            </button>
            <button
              onClick={onToggleExpanded}
              disabled={!canInteract}
              aria-label="Buscar"
              title="Buscar"
              className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                if (!canInteract) return;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--surface-hover)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
              }}
            >
              <SearchIcon />
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        className="mx-3 h-px shrink-0"
        style={{ backgroundColor: "var(--border)" }}
      />

      {/* Conversation list — only in expanded mode */}
      {expanded && (
        <div
          className="flex-1 overflow-y-auto px-1.5"
          style={{ touchAction: "pan-y" }}
        >
          {filtered.length === 0 ? (
            <div className="py-10 px-4 text-center">
              {searchQuery ? (
                <>
                  <p
                    className="text-[13px] font-medium mb-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Sin resultados
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Prueba con otro termino
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <NewChatIcon />
                  </div>
                  <p
                    className="text-[13px] font-medium mb-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
            Tu primera conversacion
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Escribe abajo para empezar
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="pb-3">
              {grouped.order.map((label) => (
                <div key={label} className="mb-1">
                  {showLabels && (
                    <div
                      className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {label}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {grouped.map.get(label)!.map((conv) => (
                      <ConversationRow
                        key={conv.id}
                        conv={conv}
                        isActive={activeConv?.id === conv.id}
                        visible={true}
                        onSelect={() => onSelectConv(conv)}
                        onDelete={() => onDeleteConv(conv.id)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spacer when collapsed — pushes the avatar to the bottom */}
      {!expanded && <div className="flex-1" />}

      {/* Account chip — single avatar, opens account menu */}
      <div
        className="shrink-0"
        style={{
          padding: expanded ? "8px 8px 12px" : "8px 8px 12px",
        }}
      >
        {expanded ? (
          <button
            onClick={onShowAccountMenu}
            disabled={!canInteract}
            className="w-full flex items-center gap-2 h-10 px-2.5 rounded-lg transition-colors duration-150"
            style={{ backgroundColor: "transparent" }}
            onMouseEnter={(e) => {
              if (!canInteract) return;
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "transparent";
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--primary-hover))",
              }}
            >
              {avatarLetter}
            </div>
            <span
              className="flex-1 min-w-0 truncate text-left text-[13px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {userEmail || "Cuenta"}
            </span>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={onShowAccountMenu}
              disabled={!canInteract}
              aria-label="Cuenta"
              title="Cuenta"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer transition-opacity"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                opacity: canInteract ? 1 : 0.6,
              }}
            >
              {avatarLetter}
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
  searchQuery,
  setSearchQuery,
  userEmail,
  profile,
  onSelectConv,
  onDeleteConv,
  onNewConversation,
  onShowAccountMenu,
  showMobile,
  onCloseMobile,
  disabled,
}: Props) {
  // Suppress unused-var warning for `profile` — kept in the prop type so the
  // parent (ChatInterface) doesn't need to refactor its call site.
  void profile;

  // ── Desktop collapse/expand state ──
  // `lock` persists to localStorage: "locked" keeps the sidebar open at all
  // times, "unlocked" lets it collapse on mouse-leave. We hydrate from
  // localStorage in an effect (not in the useState initializer) to avoid the
  // SSR/CSR mismatch that would otherwise happen on the first paint.
  const [lock, setLock] = React.useState<"locked" | "unlocked">("unlocked");
  const [hovered, setHovered] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const [transitionEnabled, setTransitionEnabled] = React.useState(false);
  // Track whether the cursor has entered the sidebar at least once — without
  // this, the first paint fires a synthetic mouseLeave that would collapse
  // the sidebar back to 60px right after the entrance animation.
  const hasEnteredRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("vechat-sidebar-lock");
    if (stored === "locked" || stored === "unlocked") {
      setLock(stored);
    }
    setInitialized(true);
    // Enable the width transition on the next frame so the initial mount
    // (which uses `none` to prevent a flash) doesn't animate from 0→60.
    const id = requestAnimationFrame(() => setTransitionEnabled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("vechat-sidebar-lock", lock);
  }, [lock]);

  // Expanded = initialized AND (locked OR hovered). The `initialized` gate
  // forces the sidebar to render collapsed on first paint, then expand on
  // the next tick — that's what produces the 60→280 entrance.
  const expanded = initialized && (lock === "locked" || hovered);

  const toggleLock = () => {
    setLock((cur) => (cur === "locked" ? "unlocked" : "locked"));
  };

  const onToggleExpanded = () => {
    // Called from the collapsed-mode expand button. Toggles lock so the
    // sidebar stays open after the click.
    setLock((cur) => (cur === "locked" ? "unlocked" : "locked"));
  };

  // ── Mobile sheet state ──
  // The mobile sidebar slides in from the left when `showMobile` is true.
  // Backdrop click closes it. Body scroll is left alone — the sheet is
  // already sized to the viewport and its content scrolls internally.
  const [hasOpened, setHasOpened] = React.useState(false);
  // Measure viewport on mount and on resize so the sheet width matches the
  // current screen. Read in an effect, not during render, to avoid the
  // SSR/CSR mismatch warning — SSR sees `mobileSheetW = EXPANDED_W` and CSR
  // sees the real `min(EXPANDED_W, 0.92 * innerWidth)` after mount.
  const [mobileSheetW, setMobileSheetW] = React.useState(EXPANDED_W);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () =>
      setMobileSheetW(Math.min(EXPANDED_W, 0.92 * window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  React.useEffect(() => {
    if (showMobile) {
      // Reset to false so the slide-in animation replays every time the
      // sheet is reopened.
      setHasOpened(false);
      const id = requestAnimationFrame(() => setHasOpened(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showMobile]);

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="relative shrink-0 hidden md:block"
        style={{
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          transition: transitionEnabled ? WIDTH_TRANSITION : "none",
        }}
        onMouseEnter={() => {
          hasEnteredRef.current = true;
          if (lock === "unlocked") setHovered(true);
        }}
        onMouseLeave={() => {
          if (hasEnteredRef.current && lock === "unlocked") setHovered(false);
        }}
      >
        <SidebarBody
          conversations={conversations}
          activeConv={activeConv}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          userEmail={userEmail}
          onSelectConv={onSelectConv}
          onDeleteConv={onDeleteConv}
          onNewConversation={onNewConversation}
          onShowAccountMenu={onShowAccountMenu}
          expanded={expanded}
          onToggleExpanded={toggleLock}
          disabled={!!disabled}
          variant="desktop"
        />
      </div>

      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
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
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        style={{
          width: mobileSheetW,
          transform: hasOpened ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.32s cubic-bezier(0.2, 0, 0, 1)",
          touchAction: "pan-y",
        }}
      >
        <SidebarBody
          conversations={conversations}
          activeConv={activeConv}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          userEmail={userEmail}
          onSelectConv={onSelectConv}
          onDeleteConv={onDeleteConv}
          onNewConversation={onNewConversation}
          onShowAccountMenu={onShowAccountMenu}
          expanded={true}
          onToggleExpanded={onCloseMobile}
          disabled={!!disabled}
          variant="mobile"
        />
      </div>
    </>
  );
}
