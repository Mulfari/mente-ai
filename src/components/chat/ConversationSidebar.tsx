"use client";

import React from "react";
import SwipeableConversation from "./SwipeableConversation";

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

const SIDEBAR_TRANSITION = "width 0.3s cubic-bezier(0.2, 0, 0, 1)";
const LABEL_TRANSITION = "max-width 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s cubic-bezier(0.2, 0, 0, 1) 100ms";

function formatDateLabel(conv: Conversation) {
  const dateStr = conv.updated_at && conv.updated_at !== conv.created_at ? conv.updated_at : conv.created_at;
  const d = new Date(dateStr || "");
  const now = new Date();
  const isValidDate = !isNaN(d.getTime());
  if (!isValidDate) return "";
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return isToday ? "Hoy" : isYesterday ? "Ayer" : diffDays > 1 ? `Hace ${diffDays} días` : "";
}

type MobileSidebarProps = {
  showSidebar: boolean;
  userEmail: string;
  onCloseSidebar: () => void;
  onNewConversation: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  conversations: Conversation[];
  activeConv: Conversation | null;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onShowAccountMenu: () => void;
  profile: ProfileData;
  onSignOut: () => void;
};

function MobileSidebar({
  showSidebar,
  userEmail,
  onCloseSidebar,
  onNewConversation,
  searchQuery,
  setSearchQuery,
  conversations,
  activeConv,
  onSelectConv,
  onDeleteConv,
  onShowAccountMenu,
  profile,
  onSignOut,
}: MobileSidebarProps) {
  const [hasOpened, setHasOpened] = React.useState(false);
  React.useEffect(() => {
    setHasOpened(true);
  }, []);

  if (!showSidebar) return null;
  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-[300px] max-sm:w-[92vw] flex flex-col md:hidden ${!userEmail ? "opacity-50 pointer-events-none select-none" : ""}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
        borderRight: "1px solid var(--border)",
        transform: hasOpened ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.2, 0, 0, 1)",
        touchAction: "pan-y",
        overflowY: "auto",
        scrollbarWidth: "none",
      }}>
      <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VeChat</span>
        </div>
        <button onClick={onCloseSidebar} className="md:hidden p-2 rounded-xl cursor-pointer"
          style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 shrink-0 pb-3 space-y-2">
        <button onClick={onNewConversation}
          className="group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 active:scale-[0.97]"
          style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = "var(--primary)";
            el.style.backgroundColor = "var(--surface-hover)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = "rgba(255,255,255,0.8)";
            el.style.backgroundColor = "transparent";
          }}
        >
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="relative">Nueva conversación</span>
        </button>

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            style={{ color: "var(--text-tertiary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar conversaciones..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
            style={{ backgroundColor: "var(--surface-hover)", color: "rgba(255,255,255,0.8)", border: "1px solid transparent", outline: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--surface)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
          />
        </div>
      </div>

      <div className="px-4 pb-1 shrink-0" style={{ height: "1px", backgroundColor: "var(--border)" }} />

      <div className="flex-1 overflow-y-auto px-2" style={{ touchAction: "pan-y" }}>
        {conversations.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{searchQuery ? "Sin resultados" : "Sin conversaciones"}</p>
          </div>
        ) : (
          <div className="space-y-0.5 pb-4">
            {conversations.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => {
              const isActive = activeConv?.id === conv.id;
              return (
                <div key={conv.id}>
                  <SwipeableConversation
                    conv={conv}
                    isActive={isActive}
                    dateLabel={formatDateLabel(conv)}
                    onSelect={() => onSelectConv(conv)}
                    onDelete={() => onDeleteConv(conv.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onShowAccountMenu}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
            {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
            {profile && (
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
              </p>
            )}
          </div>
          {profile && (
            <div className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
          )}
        </button>
        <button onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mt-1"
          style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-xs">Cerrar sesion</span>
        </button>
      </div>
    </div>
  );
}

type DesktopSidebarProps = {
  sidebarLock: "locked" | "unlocked";
  setSidebarLock: (v: "locked" | "unlocked") => void;
  sidebarHovered: boolean;
  setSidebarHovered: (v: boolean) => void;
  transitionEnabled: boolean;
  sidebarInitialized: boolean;
  userEmail: string;
  onNewConversation: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  conversations: Conversation[];
  activeConv: Conversation | null;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onShowAccountMenu: () => void;
  profile: ProfileData;
  onSignOut: () => void;
};

function DesktopSidebar({
  sidebarLock,
  setSidebarLock,
  sidebarHovered,
  setSidebarHovered,
  transitionEnabled,
  sidebarInitialized,
  userEmail,
  onNewConversation,
  searchQuery,
  setSearchQuery,
  conversations,
  activeConv,
  onSelectConv,
  onDeleteConv,
  onShowAccountMenu,
  profile,
  onSignOut,
}: DesktopSidebarProps) {
  // During the first render sidebarInitialized is false, so the sidebar starts
  // collapsed (56px). Once the parent flips the flag in its mount effect, the
  // expanded state goes true and the width transition fires 56→320 — the
  // left-to-right entrance the user wanted. After the first mount, the flag
  // stays true forever, so subsequent renders behave normally.
  const expanded = sidebarInitialized && (sidebarLock === "locked" || sidebarHovered);

  return (
    <div
      className="relative shrink-0 hidden md:flex flex-col"
      style={{
        width: expanded ? 320 : 56,
        transition: transitionEnabled ? SIDEBAR_TRANSITION : "none",
      }}
    >
      <div
        className={`h-full flex flex-col overflow-hidden ${!userEmail ? "opacity-50 pointer-events-none select-none" : ""}`}
        style={{
          backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
          backdropFilter: "blur(40px)",
          borderRight: "1px solid var(--border)",
        }}
        onMouseEnter={() => { if (sidebarLock === "unlocked") setSidebarHovered(true); }}
        onMouseLeave={() => { if (sidebarLock === "unlocked") setSidebarHovered(false); }}
      >
        {/* Brand row */}
        <div className="h-14 flex items-center shrink-0">
          <div className="w-14 flex items-center justify-center shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </div>
          <span
            className="sidebar-label-in text-base font-semibold tracking-tight whitespace-nowrap overflow-hidden"
            style={{
              color: "var(--text-primary)",
              maxWidth: expanded ? "160px" : 0,
              opacity: expanded ? 1 : 0,
              transition: LABEL_TRANSITION,
            }}
          >
            VeChat
          </span>
          {expanded && (
            <button
              onClick={() => setSidebarLock(sidebarLock === "locked" ? "unlocked" : "locked")}
              className="ml-auto mr-2 p-2 rounded-xl cursor-pointer transition-colors duration-150"
              style={{ color: "var(--text-tertiary)" }}
              title={sidebarLock === "locked" ? "Sidebar fija (clic para desbloquear)" : "Sidebar colapsable al hacer hover"}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            >
              {sidebarLock === "locked" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Actions: new chat + search */}
        <div className="px-2 shrink-0 pb-2 space-y-1">
          <button
            onClick={onNewConversation}
            className={`group w-full flex items-center rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 ${expanded ? "h-9 px-2 gap-2" : "h-10 justify-center"}`}
            style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--primary)";
              el.style.backgroundColor = "var(--surface-hover)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "rgba(255,255,255,0.8)";
              el.style.backgroundColor = "transparent";
            }}
            title="Nueva conversación"
          >
            <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {expanded && (
              <span
                className="sidebar-label-in whitespace-nowrap overflow-hidden"
                style={{
                  maxWidth: expanded ? "200px" : 0,
                  opacity: expanded ? 1 : 0,
                  transition: LABEL_TRANSITION,
                }}
              >
                Nueva conversación
              </span>
            )}
          </button>

          <div
            className={`w-full flex items-center rounded-lg transition-colors duration-150 ${expanded ? "h-9 px-2 gap-2" : "h-10 justify-center"}`}
            style={{ backgroundColor: expanded ? "var(--surface-hover)" : "transparent" }}
            title="Buscar conversaciones"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
              style={{ color: "var(--text-tertiary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {expanded && (
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar conversaciones..."
                className="flex-1 outline-none bg-transparent text-xs min-w-0"
                style={{ color: "rgba(255,255,255,0.8)" }}
              />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px shrink-0" style={{ backgroundColor: "var(--border)" }} />

        {/* Conversation list — only when expanded */}
        {expanded && (
          <div
            className="sidebar-list-in flex-1 overflow-y-auto px-2"
            style={{ touchAction: "pan-y" }}
            key="conversation-list"
          >
            {conversations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{searchQuery ? "Sin resultados" : "Sin conversaciones"}</p>
              </div>
            ) : (
              <div className="space-y-0.5 pb-4">
                {conversations.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => {
                  const isActive = activeConv?.id === conv.id;
                  return (
                    <div key={conv.id}
                      className="group w-full text-left rounded-xl flex items-center gap-3 cursor-pointer transition-colors duration-150 px-3 py-3 relative"
                      onClick={() => onSelectConv(conv)}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.backgroundColor = "var(--surface-hover)";
                        el.style.boxShadow = "inset 3px 0 0 var(--primary)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.backgroundColor = "transparent";
                        el.style.boxShadow = "none";
                      }}>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                      )}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface-hover)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                          style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--text-primary)" }}>{conv.title}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>{formatDateLabel(conv)}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id); }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity duration-150 flex items-center justify-center cursor-pointer"
                        style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.1)" }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.2)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.08)";
                        }}
                        title="Eliminar conversación">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Account chip */}
        <div className="px-2 pb-3 pt-2 shrink-0">
          <button
            onClick={onShowAccountMenu}
            className={`w-full flex items-center rounded-xl transition-colors duration-150 ${expanded ? "h-10 px-2 gap-2" : "h-10 justify-center"}`}
            style={{ backgroundColor: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            title={userEmail || "Cuenta"}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            {expanded && (
              <>
                <div
                  className="sidebar-label-in flex-1 text-left min-w-0 overflow-hidden"
                  style={{
                    maxWidth: expanded ? "180px" : 0,
                    opacity: expanded ? 1 : 0,
                    transition: LABEL_TRANSITION,
                  }}
                >
                  <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
                  {profile && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
                    </p>
                  )}
                </div>
                {profile && (
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
                )}
              </>
            )}
          </button>
          {expanded && (
            <button onClick={onSignOut}
              className="w-full flex items-center h-9 px-2 mt-1 rounded-xl transition-colors duration-150"
              style={{ color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span
                className="sidebar-label-in ml-2 text-xs whitespace-nowrap overflow-hidden"
                style={{
                  maxWidth: expanded ? "200px" : 0,
                  opacity: expanded ? 1 : 0,
                  transition: LABEL_TRANSITION,
                }}
              >
                Cerrar sesion
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = {
  showSidebar: boolean;
  conversations: Conversation[];
  activeConv: Conversation | null;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  userEmail: string;
  profile: ProfileData;
  supabase: any;
  onSelectConv: (conv: Conversation) => void;
  onDeleteConv: (convId: string) => void;
  onNewConversation: () => void;
  onShowAccountMenu: () => void;
  onSignOut: () => void;
  onCloseSidebar: () => void;
  sidebarLock: "locked" | "unlocked";
  setSidebarLock: (v: "locked" | "unlocked") => void;
  sidebarHovered: boolean;
  setSidebarHovered: (v: boolean) => void;
  transitionEnabled: boolean;
  sidebarInitialized: boolean;
};

export default function ConversationSidebar({
  showSidebar,
  conversations,
  activeConv,
  searchQuery,
  setSearchQuery,
  userEmail,
  profile,
  supabase,
  onSelectConv,
  onDeleteConv,
  onNewConversation,
  onShowAccountMenu,
  onSignOut,
  onCloseSidebar,
  sidebarLock,
  setSidebarLock,
  sidebarHovered,
  setSidebarHovered,
  transitionEnabled,
  sidebarInitialized,
}: Props) {
  void supabase;
  return (
    <>
      <MobileSidebar
        showSidebar={showSidebar}
        userEmail={userEmail}
        onCloseSidebar={onCloseSidebar}
        onNewConversation={onNewConversation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        conversations={conversations}
        activeConv={activeConv}
        onSelectConv={onSelectConv}
        onDeleteConv={onDeleteConv}
        onShowAccountMenu={onShowAccountMenu}
        profile={profile}
        onSignOut={onSignOut}
      />
      <DesktopSidebar
        sidebarLock={sidebarLock}
        setSidebarLock={setSidebarLock}
        sidebarHovered={sidebarHovered}
        setSidebarHovered={setSidebarHovered}
        transitionEnabled={transitionEnabled}
        sidebarInitialized={sidebarInitialized}
        userEmail={userEmail}
        onNewConversation={onNewConversation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        conversations={conversations}
        activeConv={activeConv}
        onSelectConv={onSelectConv}
        onDeleteConv={onDeleteConv}
        onShowAccountMenu={onShowAccountMenu}
        profile={profile}
        onSignOut={onSignOut}
      />
    </>
  );
}
