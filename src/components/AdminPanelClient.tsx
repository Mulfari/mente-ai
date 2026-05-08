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

export default function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [weeksToAdd, setWeeksToAdd] = useState<Record<string, number>>({});
  const supabase = createClient();

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
        subscription_weeks: p.subscription_weeks,
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

  async function activateUser(userId: string, weeks: number = 0) {
    setActionLoading(userId + "-activate");
    const updates: any = {
      status: "active",
      subscription_start: new Date().toISOString(),
    };
    if (weeks > 0) {
      const current = users.find(u => u.id === userId);
      updates.subscription_weeks = (current?.subscription_weeks || 0) + weeks;
    }
    await supabase.from("profiles").update(updates).eq("id", userId);
    await loadUsers();
    setActionLoading(null);
  }

  async function deactivateUser(userId: string) {
    setActionLoading(userId + "-deactivate");
    await supabase.from("profiles").update({ status: "cancelled" }).eq("id", userId);
    await loadUsers();
    setActionLoading(null);
  }

  async function addWeeks(userId: string, weeks: number) {
    if (weeks <= 0) return;
    setActionLoading(userId + "-add");
    const current = users.find(u => u.id === userId);
    await supabase.from("profiles")
      .update({ subscription_weeks: (current?.subscription_weeks || 0) + weeks })
      .eq("id", userId);
    await loadUsers();
    setActionLoading(null);
  }

  async function deleteUser(userId: string) {
    if (!confirm("¿Eliminar esta cuenta? Esta acción no se puede deshacer.")) return;
    setActionLoading(userId + "-delete");
    await supabase.from("profiles").delete().eq("id", userId);
    // Also delete from auth (if possible)
    await supabase.auth.admin.deleteUser(userId);
    await loadUsers();
    setActionLoading(null);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b shrink-0"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Mulfai</span>
            <span className="text-xs ml-2 px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--primary)", color: "white" }}>Admin</span>
          </div>
        </div>
        <button onClick={() => window.location.href = "/"}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-secondary)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Volver
        </button>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Panel de administración</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Gestiona usuarios, activa suscripciones y controla el acceso
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2.5" style={{ color: "var(--text-secondary)" }}>
              <div className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
              <span className="text-sm">Cargando usuarios...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id}
                className="rounded-2xl p-5 transition-all"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                {/* User info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.status === "active" ? "" : ""
                        }`}
                          style={{
                            backgroundColor: user.status === "active" ? "rgba(16,163,127,0.15)" : user.status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                            color: user.status === "active" ? "var(--primary)" : user.status === "pending" ? "var(--warning)" : "var(--danger)",
                          }}>
                          {user.status === "active" ? "Activo" : user.status === "pending" ? "Pendiente" : user.status === "cancelled" ? "Cancelado" : "Rechazado"}
                        </span>
                        {user.role === "admin" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    Registro: {formatDate(user.created_at)}
                  </p>
                </div>

                {/* Subscription info */}
                {user.status === "active" && (
                  <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: "var(--background)" }}>
                    <svg className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Suscripción</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {user.subscription_weeks} semanas
                        {user.subscription_start && ` · desde ${formatDate(user.subscription_start)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={weeksToAdd[user.id] || 1}
                        onChange={e => setWeeksToAdd({ ...weeksToAdd, [user.id]: parseInt(e.target.value) || 1 })}
                        className="w-16 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>semanas</span>
                      <button
                        onClick={() => addWeeks(user.id, weeksToAdd[user.id] || 1)}
                        disabled={actionLoading === user.id + "-add"}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: "var(--primary)", color: "white" }}>
                        + Agregar
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {user.status !== "active" ? (
                    <button
                      onClick={() => activateUser(user.id, weeksToAdd[user.id] || 1)}
                      disabled={actionLoading === user.id + "-activate"}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Activar ({weeksToAdd[user.id] || 1} sem.)
                    </button>
                  ) : (
                    <button
                      onClick={() => deactivateUser(user.id)}
                      disabled={actionLoading === user.id + "-deactivate" || user.role === "admin"}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "var(--danger)" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Desactivar
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(user.id)}
                    disabled={actionLoading === user.id + "-delete" || user.role === "admin"}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                    style={{ color: "var(--danger)" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                  {actionLoading && (
                    <div className="w-4 h-4 border-2 rounded-full animate-spin ml-2"
                      style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No hay usuarios registrados</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}