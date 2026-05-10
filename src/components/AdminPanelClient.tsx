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
  used_coupon_label: string | null;
  used_coupon_label_color: string | null;
};

type Coupon = {
  id: string;
  code: string;
  created_by: string;
  created_at: string;
  used_by: string | null;
  used_by_email: string | null;
  used_by_name: string | null;
  used_at: string | null;
  duration_days: number | null;
  label: string | null;
  color: string | null;
  is_unlimited: boolean;
};

type CouponType = "trial" | "weekly" | "unlimited";
type CouponFilter = "all" | "available" | "used";

type Tab = "users" | "coupons";
type Toast = { id: string; type: "success" | "error"; message: string };

export default function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [weeksToAdd, setWeeksToAdd] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "cancelled" | "pending">("all");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCouponCount, setNewCouponCount] = useState(1);
  const [generatingCoupons, setGeneratingCoupons] = useState(false);
  const [selectedCouponType, setSelectedCouponType] = useState<CouponType>("weekly");
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("all");
  const supabase = createClient();

  function showToast(type: "success" | "error", message: string) {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function loadUsers() {
    setLoading(true);

    // Fetch via server-side API route to avoid RLS/cross-origin issues
    const res = await fetch("/api/admin/list-users");
    const { users: authUsersList } = await res.json();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const merged = (profiles || []).map(p => {
      const authUser = authUsersList?.find((u: any) => u.id === p.id);
      return {
        id: p.id,
        email: authUser?.email || "Sin email",
        status: p.status,
        subscription_weeks: p.subscription_weeks ?? 0,
        subscription_start: p.subscription_start,
        role: p.role,
        created_at: authUser?.created_at || p.created_at,
        used_coupon_label: p.used_coupon_label ?? null,
        used_coupon_label_color: p.used_coupon_label_color ?? null,
      } as Profile;
    });

    setUsers(merged);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function loadCoupons() {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCoupons(data);
  }

  useEffect(() => {
    if (activeTab === "coupons") loadCoupons();
  }, [activeTab]);

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
    const { error } = await supabase.from("profiles").update({ status: "inactive" }).eq("id", userId);
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
    if (!confirm("¿Eliminar esta cuenta? Esta accion no se puede deshacer.")) return;
    setActionLoading(userId + "-delete");
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    await loadUsers();
    setActionLoading(null);
    showToast("success", "Usuario eliminado");
  }

  async function sendConfirmationEmail(userId: string, email: string) {
    setActionLoading(userId + "-confirm");
    try {
      const res = await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_id: userId }),
      });
      if (res.ok) {
        showToast("success", "Correo de confirmacion enviado");
      } else {
        const data = await res.json();
        showToast("error", data.error || "Error al enviar correo");
      }
    } catch {
      showToast("error", "Error al enviar correo");
    }
    setActionLoading(null);
  }

  async function generateCoupons(count: number, type: CouponType) {
    setGeneratingCoupons(true);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      let code = "MLF-";
      for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
      codes.push(code);
    }
    const adminUser = (await supabase.auth.getUser()).data.user;

    const couponConfig: Record<CouponType, { duration_days: number | null; label: string; color: string; is_unlimited: boolean }> = {
      trial: { duration_days: 3, label: "Prueba gratuita", color: "#F59E0B", is_unlimited: false },
      weekly: { duration_days: 7, label: "Suscripcion semanal", color: "#10A37F", is_unlimited: false },
      unlimited: { duration_days: null, label: "Acceso ilimitado", color: "#8b5cf6", is_unlimited: true },
    };
    const config = couponConfig[type];

    const inserts = codes.map(c => ({
      code: c,
      created_by: adminUser?.id,
      ...config,
    }));
    const { error } = await supabase.from("coupons").insert(inserts);
    setGeneratingCoupons(false);
    if (error) showToast("error", "Error al generar cupones");
    else {
      showToast("success", `${count} cupon(es) ${type === "trial" ? "de prueba" : type === "weekly" ? "semanales" : "ilimitados"} generado(s)`);
      loadCoupons();
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function deleteCoupon(couponId: string) {
    if (!confirm("¿Eliminar este cupón? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", couponId);
    if (error) showToast("error", "Error al eliminar cupón");
    else {
      showToast("success", "Cupón eliminado");
      loadCoupons();
    }
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
    inactive: users.filter(u => u.status === "inactive").length,
    cancelled: users.filter(u => u.status === "cancelled").length,
    pending: users.filter(u => u.status === "pending").length,
  };

  const couponStats = {
    total: coupons.length,
    used: coupons.filter(c => c.used_by != null).length,
    unused: coupons.filter(c => c.used_by == null).length,
  };

  const filteredCoupons = coupons.filter(c => {
    if (couponFilter === "available") return !c.used_by;
    if (couponFilter === "used") return !!c.used_by;
    return true;
  });

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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4h2l2.5 8.5L10 5.5 12.5 12.5 15 5.5l2.5 8.5H17L14.5 4h2l-3 10H6L3 4z"/>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--primary)" }}>M</span>ulfai
            </span>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Panel de administracion</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Gestiona usuarios, activa suscripciones y genera cupones</p>
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
              <span style={{ color: "var(--warning)" }}>Inactivos</span>
              <span className="font-bold" style={{ color: "var(--warning)" }}>{stats.inactive}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span style={{ color: "var(--danger)" }}>Cancelados</span>
              <span className="font-bold" style={{ color: "var(--danger)" }}>{stats.cancelled}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <span style={{ color: "#8b5cf6" }}>Pendientes</span>
              <span className="font-bold" style={{ color: "#8b5cf6" }}>{stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl self-start sm:self-auto" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            {(["users", "coupons"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: activeTab === t ? "var(--primary)" : "transparent",
                  color: activeTab === t ? "white" : "var(--text-secondary)",
                }}>
                {t === "users" ? "Usuarios" : "Cupones"}
              </button>
            ))}
          </div>
          {activeTab === "coupons" && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                {([["trial", "Prueba"], ["weekly", "Semanal"], ["unlimited", "Ilimitado"]] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setSelectedCouponType(t as CouponType)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: selectedCouponType === t ? (t === "trial" ? "#F59E0B" : t === "weekly" ? "#10A37F" : "#8b5cf6") : "transparent",
                      color: selectedCouponType === t ? "white" : "var(--text-secondary)",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <input type="number" min="1" max="50" value={newCouponCount}
                onChange={e => setNewCouponCount(parseInt(e.target.value) || 1)}
                className="w-16 px-3 py-2 rounded-xl text-sm text-center outline-none"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button onClick={() => generateCoupons(newCouponCount, selectedCouponType)} disabled={generatingCoupons}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {generatingCoupons ? "Generando..." : "Generar"}
              </button>
            </div>
          )}
        </div>

        {/* Coupon stats */}
        {activeTab === "coupons" && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Total</span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>{couponStats.total}</span>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: "rgba(16,163,127,0.12)", border: "1px solid rgba(16,163,127,0.2)" }}>
                <span style={{ color: "var(--primary)" }}>Usados</span>
                <span className="font-bold" style={{ color: "var(--primary)" }}>{couponStats.used}</span>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span style={{ color: "var(--warning)" }}>Disponibles</span>
                <span className="font-bold" style={{ color: "var(--warning)" }}>{couponStats.unused}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl self-start sm:self-auto" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              {([["all", "Todos"], ["available", "Disp."], ["used", "Usados"]] as const).map(([f, label]) => (
                <button key={f} onClick={() => setCouponFilter(f as CouponFilter)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: couponFilter === f ? "var(--primary)" : "transparent",
                    color: couponFilter === f ? "white" : "var(--text-secondary)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Users section */}
        {activeTab === "users" && (
          <>
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
                {(["all", "active", "inactive", "cancelled", "pending"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: filter === f ? "var(--primary)" : "transparent",
                      color: filter === f ? "white" : "var(--text-secondary)",
                    }}>
                    {f === "all" ? "Todos" : f === "active" ? "Activos" : f === "inactive" ? "Inactivos" : f === "cancelled" ? "Cancelados" : "Pendientes"}
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
                  {search ? "No se encontraron usuarios" : "No hay usuarios aun"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {search ? "Intenta con otro correo electronico" : "Los usuarios apareceran cuando se registren"}
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
                                    backgroundColor: user.status === "active" ? "rgba(16,163,127,0.15)" : user.status === "inactive" ? "rgba(245,158,11,0.15)" : user.status === "pending" ? "rgba(139,92,246,0.15)" : "rgba(239,68,68,0.15)",
                                    color: user.status === "active" ? "var(--primary)" : user.status === "inactive" ? "var(--warning)" : user.status === "pending" ? "#8b5cf6" : "var(--danger)",
                                  }}>
                                  {user.status === "active" ? "Activo" : user.status === "inactive" ? "Inactivo" : user.status === "cancelled" ? "Cancelado" : user.status === "pending" ? "Pendiente" : "Rechazado"}
                                </span>
                                {isAdmin && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                                    Admin
                                  </span>
                                )}
                                {user.used_coupon_label && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ backgroundColor: user.used_coupon_label_color ? `${user.used_coupon_label_color}22` : "rgba(139,92,246,0.15)", color: user.used_coupon_label_color || "#8b5cf6" }}>
                                    {user.used_coupon_label}
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

                      {/* Subscription row */}
                      {(user.status === "active" || user.status === "inactive") && (
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
                                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Suscripcion</p>
                                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                  {user.subscription_weeks < 0 ? "∞" : `${user.subscription_weeks} semana${user.subscription_weeks !== 1 ? "s" : ""}`}
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
                          <>
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
                            <button
                              onClick={() => sendConfirmationEmail(user.id, user.email)}
                              disabled={actionLoading === user.id + "-confirm"}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                              style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)" }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Enviar correo
                            </button>
                          </>
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
          </>
        )}

        {/* Coupons section */}
        {activeTab === "coupons" && (
          <>
            {coupons.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "var(--surface)" }}>
                  <svg className="w-7 h-7" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Sin cupones</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Genera cupones para distribuir a tus revendores</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCoupons.map(c => (
                  <div key={c.id}
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-bold tracking-wider px-3 py-1.5 rounded-xl"
                          style={{ backgroundColor: "var(--background)", color: "var(--primary)" }}>
                          {c.code}
                        </code>
                        {c.color && (
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        )}
                        {c.label && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor: c.color ? `${c.color}22` : "rgba(245,158,11,0.12)",
                              color: c.color || "var(--warning)",
                            }}>
                            {c.label}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: c.used_by ? "rgba(16,163,127,0.12)" : "rgba(245,158,11,0.12)",
                            color: c.used_by ? "var(--primary)" : "var(--warning)",
                          }}>
                          {c.used_by ? "Usado" : "Disponible"}
                        </span>
                      </div>
                      {c.used_by && (
                        <div className="flex items-center gap-2 mt-2">
                          <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                            {c.used_by_name || c.used_by_email}
                          </p>
                          <span style={{ color: "var(--text-tertiary)" }}>·</span>
                          <p className="text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
                            {formatDate(c.used_at)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!c.used_by && (
                        <button onClick={() => copyToClipboard(c.code)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copiar
                        </button>
                      )}
                      <button onClick={() => deleteCoupon(c.id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                        style={{ color: "var(--danger)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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