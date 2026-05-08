"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  status: string;
  subscription_weeks: number;
  subscription_start: string | null;
  role: string;
  created_at: string;
};

type Toast = { id: string; type: "success" | "error"; message: string };

export default function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [weeksToAdd, setWeeksToAdd] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "cancelled">("all");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const supabase = createClient();

  function showToast(type: "success" | "error", message: string) {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function loadUsers() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: authUsersList } = await supabase.auth.admin.listUsers();

    const merged = (profiles || []).map(p => {
      const authUser = authUsersList?.users.find(u => u.id === p.id);
      return {
        id: p.id,
        email: authUser?.email || "Sin email",
        status: p.status,
        subscription_weeks: p.subscription_weeks ?? 0,
        subscription_start: p.subscription_start,
        role: p.role,
        created_at: authUser?.created_at || p.created_at,
      } as Profile;
    });

    setUsers(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function activateUser(userId: string, weeks: number = 1) {
    setActionLoading(userId + "-activate");
    const updates: Record<string, unknown> = {
      status: "active",
      subscription_start: new Date().toISOString(),
    };
    if (weeks > 0) {
      const current = users.find(u => u.id === userId);
      updates.subscription_weeks = (current?.subscription_weeks ?? 0) + weeks;
    }
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    await loadUsers();
    setActionLoading(null);
    if (error) showToast("error", "Error al activar usuario");
    else showToast("success", "Usuario activado correctamente");
  }

  async function deactivateUser(userId: string) {
    setActionLoading(userId + "-deactivate");
    const { error } = await supabase.from("profiles").update({ status: "cancelled" }).eq("id", userId);
    await loadUsers();
    setActionLoading(null);
    if (error) showToast("error", "Error al desactivar usuario");
    else showToast("success", "Usuario desactivado");
  }

  async function addWeeks(userId: string, weeks: number) {
    if (weeks <= 0) return;
    setActionLoading(userId + "-add");
    const current = users.find(u => u.id === userId);
    const { error } = await supabase.from("profiles")
      .update({ subscription_weeks: (current?.subscription_weeks ?? 0) + weeks })
      .eq("id", userId);
    await loadUsers();
    setActionLoading(null);
    if (error) showToast("error", "Error al agregar semanas");
    else showToast("success", `+${weeks} semana(s) agregada(s)`);
  }

  async function deleteUser(userId: string) {
    if (!confirm("¿Eliminar esta cuenta? Esta acción no se puede deshacer.")) return;
    setActionLoading(userId + "-delete");
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    await loadUsers();
    setActionLoading(null);
    showToast("success", "Usuario eliminado");
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  function getEndDate(start: string | null, weeks: number) {
    if (!start || weeks <= 0) return null;
    const d = new Date(start);
    d.setDate(d.getDate() + weeks * 7);
    return d;
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || u.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    pending: users.filter(u => u.status === "pending").length,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Toast notifications */}
      <div className="fixed top-5 right-5 z-50 space-y-2">
        {toasts.map(toast => (
          <div key={toast.id}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium animate-slide-in"
            style={{
              backgroundColor: toast.type === "success" ? "#10A37F" : "#EF4444",
              color: "white",
              minWidth: "240px",
            }}>
            {toast.type === "success" ? (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b shrink-0 sticky top-0 z-10"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Mulfai</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
              Admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadUsers} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Volver
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Title + Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Panel de administración</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Gestiona usuarios, activa suscripciones y controla el acceso
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>Total</span>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>{stats.total}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: "rgba(16,163,127,0.12)", border: "1px solid rgba(16,163,127,0.2)" }}>
              <span style={{ color: "var(--primary)" }}>Activos</span>
              <span className="font-bold" style={{ color: "var(--primary)" }}>{stats.active}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span style={{ color: "var(--warning)" }}>Pendientes</span>
              <span className="font-bold" style={{ color: "var(--warning)" }}>{stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            {(["all", "active", "pending", "cancelled"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: filter === f ? "var(--primary)" : "transparent",
                  color: filter === f ? "white" : "var(--text-secondary)",
                }}>
                {f === "all" ? "Todos" : f === "active" ? "Activos" : f === "pending" ? "Pendientes" : "Cancelados"}
              </button>
            ))}
          </div>
        </div>

        {/* Users list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
              <div className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
              <span className="text-sm">Cargando usuarios...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "var(--surface)" }}>
              <svg className="w-7 h-7" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {search ? "No se encontraron usuarios" : "No hay usuarios aún"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {search ? "Intenta con otro correo electrónico" : "Los usuarios aparecerán cuando se registren"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => {
              const isAdmin = user.role === "admin";
              const endDate = getEndDate(user.subscription_start, user.subscription_weeks);
              const endDateStr = endDate ? endDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : null;
              return (
                <div key={user.id}
                  className="rounded-2xl overflow-hidden transition-all"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  {/* Main info row */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.email}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                backgroundColor: user.status === "active" ? "rgba(16,163,127,0.15)" : user.status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                                color: user.status === "active" ? "var(--primary)" : user.status === "pending" ? "var(--warning)" : "var(--danger)",
                              }}>
                              {user.status === "active" ? "Activo" : user.status === "pending" ? "Pendiente" : user.status === "cancelled" ? "Cancelado" : "Rechazado"}
                            </span>
                            {isAdmin && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Registrado</p>
                        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{formatDate(user.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Subscription row (only for active) */}
                  {user.status === "active" && (
                    <div className="px-5 pb-4 -mt-1">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                        style={{ backgroundColor: "var(--background)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "linear-gradient(135deg, rgba(16,163,127,0.2), rgba(16,163,127,0.05))" }}>
                            <svg className="w-4 h-4" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Suscripción</p>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                              {user.subscription_weeks} semana{user.subscription_weeks !== 1 ? "s" : ""}
                              {endDateStr && <span className="text-xs font-normal ml-2" style={{ color: "var(--text-tertiary)" }}>hasta {endDateStr}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="52"
                            value={weeksToAdd[user.id] ?? 1}
                            onChange={e => setWeeksToAdd({ ...weeksToAdd, [user.id]: parseInt(e.target.value) || 1 })}
                            className="w-16 px-2 py-2 rounded-xl text-sm text-center outline-none"
                            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                          />
                          <span className="text-xs hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>sem.</span>
                          <button
                            onClick={() => addWeeks(user.id, weeksToAdd[user.id] ?? 1)}
                            disabled={actionLoading === user.id + "-add"}
                            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                            + Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="px-5 py-4 border-t flex items-center gap-2 flex-wrap"
                    style={{ borderColor: "var(--border)" }}>
                    {user.status !== "active" ? (
                      <button
                        onClick={() => activateUser(user.id, weeksToAdd[user.id] ?? 1)}
                        disabled={actionLoading === user.id + "-activate"}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white", boxShadow: "0 4px 12px rgba(16,163,127,0.3)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Activar ({weeksToAdd[user.id] ?? 1} sem.)
                      </button>
                    ) : (
                      <button
                        onClick={() => deactivateUser(user.id)}
                        disabled={actionLoading === user.id + "-deactivate" || isAdmin}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                        style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Desactivar
                      </button>
                    )}
                    <button
                      onClick={() => deleteUser(user.id)}
                      disabled={actionLoading === user.id + "-delete" || isAdmin}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                      style={{ color: "var(--danger)" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                    {actionLoading?.startsWith(user.id) && (
                      <div className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}