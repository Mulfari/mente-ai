"use client";

import { useState, useEffect } from "react";

type Props = {
  initialProfiles?: any[];
  initialCoupons?: any[];
  initialPlaces?: any[];
  initialCategories?: any[];
  initialCities?: any[];
  initialKnowledgeRules?: any[];
  initialKnowledge?: any[];
  fetchError?: string;
};

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

type CouponType = "trial" | "weekly" | "20weeks" | "unlimited";
type CouponFilter = "all" | "available" | "used";

type Tab = "users" | "coupons" | "places";
type PlaceTab = "places" | "categories" | "knowledge" | "submissions";
type Toast = { id: string; type: "success" | "error"; message: string };

export default function AdminPanel({ initialProfiles = [], initialCoupons = [], initialPlaces = [], initialCategories = [], initialCities = [], initialKnowledgeRules = [], fetchError }: Props) {
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
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("available");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userCouponHistory, setUserCouponHistory] = useState<Map<string, Coupon[]>>(new Map());
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);
  const [placesTab, setPlacesTab] = useState<PlaceTab>("places");
  const [places, setPlaces] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [knowledgeRules, setKnowledgeRules] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [placeForm, setPlaceForm] = useState({ name: "", address: "", description: "", specialty: "", phone: "", whatsapp: "", google_maps_url: "", waze_url: "", city_id: "", category_id: "", price_range: 2, featured: false, verified: false });
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", icon: "", color: "#10A37F", sort_order: 0 });
  const [ruleForm, setRuleForm] = useState({ trigger_type: "keyword", trigger_value: "", response: "", priority: 10 });

  async function adminFetch(url: string, options?: RequestInit) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  function showToast(type: "success" | "error", message: string) {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function loadUsers() {
    setLoading(true);

    let profiles: any[] = [];
    try {
      const data = await adminFetch("/api/admin/data?type=profiles");
      profiles = data.data || [];
    } catch {
      showToast("error", "Error al recargar usuarios");
    }

    const merged = (profiles || []).map(p => {
      return {
        id: p.id,
        email: p.email || "Sin email",
        status: p.status,
        subscription_weeks: p.subscription_weeks ?? 0,
        subscription_start: p.subscription_start,
        role: p.role,
        created_at: p.created_at,
        used_coupon_label: p.used_coupon_label ?? null,
        used_coupon_label_color: p.used_coupon_label_color ?? null,
      } as Profile;
    });

    setUsers(merged);
    setLoading(false);
  }

  // Load initial data from server props (bypasses Vercel Auth)
  useEffect(() => {
    const merged = (initialProfiles || []).map(p => ({
      id: p.id,
      email: p.email || "Sin email",
      status: p.status,
      subscription_weeks: p.subscription_weeks ?? 0,
      subscription_start: p.subscription_start,
      role: p.role,
      created_at: p.created_at,
      used_coupon_label: p.used_coupon_label ?? null,
      used_coupon_label_color: p.used_coupon_label_color ?? null,
    } as Profile));
    setUsers(merged);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load initial coupons from server props
  useEffect(() => {
    if (initialCoupons.length > 0) {
      setCoupons(initialCoupons);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load places data from server props
  useEffect(() => {
    setPlaces(initialPlaces);
    setCategories(initialCategories);
    setCities(initialCities);
    setKnowledgeRules(initialKnowledgeRules);
    setKnowledge(initialKnowledge || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePlace() {
    try {
      const payload = editingPlace?.id
        ? { type: "place", data: { ...placeForm, id: editingPlace.id } }
        : { type: "place", data: placeForm };
      await adminFetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("success", editingPlace?.id ? "Lugar actualizado" : "Lugar creado");
      setShowPlaceModal(false);
      setEditingPlace(null);
      setPlaceForm({ name: "", address: "", description: "", specialty: "", phone: "", whatsapp: "", google_maps_url: "", waze_url: "", city_id: "", category_id: "", price_range: 2, featured: false, verified: false });
      const data = await adminFetch("/api/admin/places?type=places");
      setPlaces(data.data || []);
    } catch { showToast("error", "Error al guardar lugar"); }
  }

  async function saveCategory() {
    try {
      const payload = editingCategory?.id
        ? { type: "category", data: { ...categoryForm, id: editingCategory.id } }
        : { type: "category", data: categoryForm };
      await adminFetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("success", editingCategory?.id ? "Categoría actualizada" : "Categoría creada");
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", slug: "", icon: "", color: "#10A37F", sort_order: 0 });
      const data = await adminFetch("/api/admin/places?type=categories");
      setCategories(data.data || []);
    } catch { showToast("error", "Error al guardar categoría"); }
  }

  async function saveRule() {
    try {
      const payload = editingRule?.id
        ? { type: "knowledge-rule", data: { ...ruleForm, id: editingRule.id } }
        : { type: "knowledge-rule", data: ruleForm };
      await adminFetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("success", editingRule?.id ? "Regla actualizada" : "Regla creada");
      setShowRuleModal(false);
      setEditingRule(null);
      setRuleForm({ trigger_type: "keyword", trigger_value: "", response: "", priority: 10 });
      const data = await adminFetch("/api/admin/places?type=knowledge-rules");
      setKnowledgeRules(data.data || []);
    } catch { showToast("error", "Error al guardar regla"); }
  }

  async function deleteItem(type: string, id: string) {
    if (!confirm("¿Eliminar este elemento?")) return;
    try {
      await adminFetch(`/api/admin/places?type=${type}&id=${id}`, { method: "DELETE" });
      showToast("success", "Eliminado");
      if (type === "place") setPlaces(p => p.filter(x => x.id !== id));
      if (type === "category") setCategories(c => c.filter(x => x.id !== id));
      if (type === "knowledge-rule") setKnowledgeRules(r => r.filter(x => x.id !== id));
    } catch { showToast("error", "Error al eliminar"); }
  }

  async function activateUser(userId: string, weeks: number = 1) {
    setActionLoading(userId + "-activate");
    const current = users.find(u => u.id === userId);
    const updates: Record<string, unknown> = {
      status: "active",
      subscription_start: new Date().toISOString(),
    };
    if (weeks > 0) {
      updates.subscription_weeks = (current?.subscription_weeks ?? 0) + weeks;
    }
    window.location.href = `/admin?action=update-profile&userId=${userId}&updates=${encodeURIComponent(JSON.stringify(updates))}`;
  }

  async function deactivateUser(userId: string) {
    setActionLoading(userId + "-deactivate");
    const updates = { status: "inactive", subscription_weeks: 0, subscription_start: null, subscription_end: null };
    window.location.href = `/admin?action=update-profile&userId=${userId}&updates=${encodeURIComponent(JSON.stringify(updates))}`;
  }

  async function viewCouponHistory(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    try {
      const data = await adminFetch(`/api/admin/data?type=coupon-history&userId=${userId}`);
      setUserCouponHistory(prev => {
        const next = new Map(prev);
        next.set(userId, data.data || []);
        return next;
      });
    } catch {
      showToast("error", "Error al cargar historial");
    }
  }

  async function addWeeks(userId: string, weeks: number) {
    if (weeks <= 0) return;
    setActionLoading(userId + "-add");
    const current = users.find(u => u.id === userId);
    const updates = { subscription_weeks: (current?.subscription_weeks ?? 0) + weeks };
    window.location.href = `/admin?action=update-profile&userId=${userId}&updates=${encodeURIComponent(JSON.stringify(updates))}`;
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

    const couponConfig: Record<CouponType, { duration_days: number | null; label: string; color: string; is_unlimited: boolean }> = {
      trial: { duration_days: 3, label: "Prueba gratuita (3 días)", color: "#F59E0B", is_unlimited: false },
      weekly: { duration_days: 7, label: "Prueba semanal (7 días)", color: "#3B82F6", is_unlimited: false },
      "20weeks": { duration_days: 140, label: "Suscripción 20 semanas", color: "#10A37F", is_unlimited: false },
      unlimited: { duration_days: null, label: "Acceso ilimitado", color: "#8b5cf6", is_unlimited: true },
    };
    const config = couponConfig[type];

    window.location.href = `/admin?action=generate-coupons&codes=${encodeURIComponent(JSON.stringify(codes))}&config=${encodeURIComponent(JSON.stringify(config))}`;
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function deleteCoupon(couponId: string) {
    if (!confirm("¿Eliminar este cupón? Esta acción no se puede deshacer.")) return;
    window.location.href = `/admin?action=delete-coupon&id=${couponId}`;
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

  // Sort: available first (by creation date desc), then used (by used_at desc)
  const sortedCoupons = [...coupons].sort((a, b) => {
    if (a.used_by && !b.used_by) return 1;
    if (!a.used_by && b.used_by) return -1;
    if (!a.used_by) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(b.used_at || 0).getTime() - new Date(a.used_at || 0).getTime();
  });

  const filteredCoupons = sortedCoupons.filter(c => {
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
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Error display */}
        {fetchError && (
          <div className="mb-6 p-4 rounded-2xl border" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Error al cargar datos:</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{fetchError}</p>
          </div>
        )}

        {/* Title + Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>Panel de administracion</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Gestiona usuarios, activa suscripciones y genera cupones</p>
            </div>
            <a href="/" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Volver al chat
            </a>
          </div>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total usuarios", value: stats.total, color: "var(--text-primary)", bg: "var(--surface)", border: "var(--border)" },
              { label: "Activos", value: stats.active, color: "var(--primary)", bg: "rgba(16,163,127,0.08)", border: "rgba(16,163,127,0.2)" },
              { label: "Inactivos", value: stats.inactive, color: "var(--warning)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
              { label: "Cancelados", value: stats.cancelled, color: "var(--danger)", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
              { label: "Pendientes", value: stats.pending, color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 rounded-2xl" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                <p className="text-xs font-medium mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl self-start sm:self-auto" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            {(["users", "coupons", "places"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: activeTab === t ? "var(--primary)" : "transparent",
                  color: activeTab === t ? "white" : "var(--text-secondary)",
                }}>
                {t === "users" ? "Usuarios" : t === "coupons" ? "Cupones" : "Lugares"}
              </button>
            ))}
          </div>
          {activeTab === "coupons" && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                {([["trial", "3 días"], ["weekly", "7 días"], ["20weeks", "20 sem."], ["unlimited", "∞"]] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setSelectedCouponType(t as CouponType)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: selectedCouponType === t ? (t === "trial" ? "#F59E0B" : t === "weekly" ? "#3B82F6" : t === "20weeks" ? "#10A37F" : "#8b5cf6") : "transparent",
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
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: couponStats.total, color: "var(--text-primary)", bg: "var(--surface)", border: "var(--border)" },
                { label: "Usados", value: couponStats.used, color: "var(--primary)", bg: "rgba(16,163,127,0.08)", border: "rgba(16,163,127,0.2)" },
                { label: "Disponibles", value: couponStats.unused, color: "var(--warning)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
              ].map(s => (
                <div key={s.label} className="px-4 py-3 rounded-xl text-center" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-xs font-medium mb-0.5" style={{ color: s.color }}>{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl self-start" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              {([["available", "Disponibles"], ["used", "Usados"], ["all", "Todos"]] as const).map(([f, label]) => (
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
                      className="rounded-2xl overflow-hidden transition-all hover:shadow-lg"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                      {/* Main info + actions */}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold shadow-md shrink-0"
                              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                              {user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.email}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                  style={{
                                    backgroundColor: user.status === "active" ? "rgba(16,163,127,0.12)" : user.status === "inactive" ? "rgba(245,158,11,0.12)" : user.status === "pending" ? "rgba(139,92,246,0.12)" : "rgba(239,68,68,0.12)",
                                    color: user.status === "active" ? "var(--primary)" : user.status === "inactive" ? "var(--warning)" : user.status === "pending" ? "#8b5cf6" : "var(--danger)",
                                  }}>
                                  {user.status === "active" ? "Activo" : user.status === "inactive" ? "Inactivo" : user.status === "cancelled" ? "Cancelado" : user.status === "pending" ? "Pendiente" : "Rechazado"}
                                </span>
                                {isAdmin && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                    style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                                    Admin
                                  </span>
                                )}
                                {user.used_coupon_label && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                                    style={{ backgroundColor: user.used_coupon_label_color ? `${user.used_coupon_label_color}22` : "rgba(139,92,246,0.12)", color: user.used_coupon_label_color || "#8b5cf6" }}>
                                    {user.used_coupon_label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 hidden sm:block">
                            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Registrado</p>
                            <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{formatDate(user.created_at)}</p>
                          </div>
                        </div>

                        {/* Subscription info */}
                        {(user.status === "active" || user.status === "inactive") && (
                          <div className="flex items-center justify-between gap-3 p-4 rounded-xl mb-4"
                            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: "linear-gradient(135deg, rgba(16,163,127,0.15), rgba(16,163,127,0.05))" }}>
                                <svg className="w-4 h-4" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs mb-0.5" style={{ color: "var(--text-tertiary)" }}>Suscripcion</p>
                                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                                  {user.subscription_weeks < 0 ? "Ilimitado" : `${user.subscription_weeks} sem.`}
                                  {endDateStr && <span className="text-xs font-normal ml-2" style={{ color: "var(--text-tertiary)" }}>expira {endDateStr}</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="52"
                                  value={weeksToAdd[user.id] ?? 1}
                                  onChange={e => setWeeksToAdd({ ...weeksToAdd, [user.id]: parseInt(e.target.value) || 1 })}
                                  className="w-16 px-3 py-2 rounded-xl text-sm text-center outline-none font-medium"
                                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                />
                                <span className="text-xs hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>sem.</span>
                              </div>
                              <button
                                onClick={() => addWeeks(user.id, weeksToAdd[user.id] ?? 1)}
                                disabled={actionLoading === user.id + "-add"}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                                + Agregar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            onClick={() => viewCouponHistory(user.id)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90"
                            style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.15)" }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                            Cupones
                          </button>
                          {user.status !== "active" ? (
                            <>
                              <button
                                onClick={() => activateUser(user.id, weeksToAdd[user.id] ?? 1)}
                                disabled={actionLoading === user.id + "-activate"}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Activar
                              </button>
                              <button
                                onClick={() => sendConfirmationEmail(user.id, user.email)}
                                disabled={actionLoading === user.id + "-confirm"}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.15)" }}>
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
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
                              style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.15)" }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Desactivar
                            </button>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            {actionLoading?.startsWith(user.id) && (
                              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                                style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
                            )}
                            {deleteConfirmUser === user.id ? (
                              <>
                                <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>¿Eliminar?</span>
                                <button
                                  onClick={async () => {
                                    setActionLoading(user.id + "-delete");
                                    try {
                                      await adminFetch(`/api/admin/data?type=profile&id=${user.id}&email=${encodeURIComponent(user.email)}`, {
                                        method: "DELETE",
                                        headers: { "Content-Type": "application/json" },
                                      });
                                      await loadUsers();
                                      showToast("success", "Usuario eliminado");
                                    } catch {
                                      showToast("error", "Error al eliminar usuario");
                                    }
                                    setActionLoading(null);
                                    setDeleteConfirmUser(null);
                                  }}
                                  disabled={actionLoading === user.id + "-delete"}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                                  style={{ backgroundColor: "var(--danger)", color: "white" }}>
                                  Sí, eliminar
                                </button>
                                <button onClick={() => setDeleteConfirmUser(null)}
                                  className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                                  style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmUser(user.id)}
                                disabled={actionLoading === user.id + "-delete" || isAdmin}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-70"
                                style={{ color: "var(--danger)" }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Coupon history expandable section */}
                      {expandedUser === user.id && (
                        <div className="px-5 pb-5 border-t"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
                          <div className="pt-4">
                            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-tertiary)" }}>
                              HISTORIAL DE CUPONES CANJEADOS
                            </p>
                            {userCouponHistory.get(user.id)?.length ? (
                              <div className="space-y-2">
                                {userCouponHistory.get(user.id)!.map(c => (
                                  <div key={c.id}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                                    <code className="text-xs font-bold tracking-wider px-2 py-1 rounded-lg shrink-0"
                                      style={{ backgroundColor: "var(--background)", color: "var(--primary)" }}>
                                      {c.code}
                                    </code>
                                    <div className="flex items-center gap-2 flex-wrap flex-1">
                                      {c.color && (
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                      )}
                                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                        {c.label || "Cupón"}
                                      </span>
                                      {c.duration_days && (
                                        <span className="text-xs px-2 py-0.5 rounded-full"
                                          style={{ backgroundColor: "rgba(16,163,127,0.1)", color: "var(--primary)" }}>
                                          {c.duration_days} días
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
                                      {formatDate(c.used_at)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>
                                Este usuario no ha canjeado ningún cupón todavía.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
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
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all hover:shadow-md"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div className="w-3 h-12 rounded-full shrink-0" style={{ backgroundColor: c.used_by ? "var(--primary)" : "var(--warning)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <code className="text-sm font-bold tracking-wider px-3 py-1.5 rounded-xl"
                          style={{ backgroundColor: "var(--background)", color: "var(--primary)" }}>
                          {c.code}
                        </code>
                        {c.color && (
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        )}
                        {c.label && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{
                              backgroundColor: c.color ? `${c.color}18` : "rgba(245,158,11,0.1)",
                              color: c.color || "var(--warning)",
                            }}>
                            {c.label}
                          </span>
                        )}
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{
                            backgroundColor: c.used_by ? "rgba(16,163,127,0.1)" : "rgba(245,158,11,0.1)",
                            color: c.used_by ? "var(--primary)" : "var(--warning)",
                          }}>
                          {c.used_by ? "Usado" : "Disponible"}
                        </span>
                        {c.duration_days && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "var(--background)", color: "var(--text-tertiary)" }}>
                            {c.duration_days} días
                          </span>
                        )}
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
                          style={{ backgroundColor: "rgba(16,163,127,0.1)", color: "var(--primary)" }}>
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

        {/* Places section */}
        {activeTab === "places" && (
          <>
            {/* Sub-tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl mb-6 w-fit" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              {(["places", "categories", "knowledge", "submissions"] as const).map(t => (
                <button key={t} onClick={() => setPlacesTab(t)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: placesTab === t ? "var(--primary)" : "transparent",
                    color: placesTab === t ? "white" : "var(--text-secondary)",
                  }}>
                  {t === "places" ? "Lugares" : t === "categories" ? "Categorías" : t === "knowledge" ? "Conocimiento" : "Pendientes"}
                </button>
              ))}
            </div>

            {/* === LUGARES TAB === */}
            {placesTab === "places" && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setEditingPlace(null); setPlaceForm({ name: "", address: "", description: "", specialty: "", phone: "", whatsapp: "", google_maps_url: "", waze_url: "", city_id: cities[0]?.id || "", category_id: categories[0]?.id || "", price_range: 2, featured: false, verified: false }); setShowPlaceModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Añadir lugar
                  </button>
                </div>
                {placesLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} /></div>
                ) : places.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "var(--surface)" }}>
                      <svg className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Sin lugares todavía</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Añade lugares al directorio para que la IA pueda recomendarlos</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {places.map(p => (
                      <div key={p.id} className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                            style={{ backgroundColor: `${p.categories?.color || "var(--primary)"}18` }}>
                            {p.categories?.icon || "📍"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                              {p.featured && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>Destacado</span>}
                              {p.verified && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>Verificado</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.categories?.name || ""}</span>
                              <span style={{ color: "var(--text-tertiary)" }}>·</span>
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.cities?.name || ""}</span>
                            </div>
                            {p.address && <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{p.address}</p>}
                            {p.phone && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>📞 {p.phone}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => { setEditingPlace(p); setPlaceForm({ name: p.name, address: p.address || "", description: p.description || "", specialty: p.specialty || "", phone: p.phone || "", whatsapp: p.whatsapp || "", google_maps_url: p.google_maps_url || "", waze_url: p.waze_url || "", city_id: p.city_id || "", category_id: p.category_id || "", price_range: p.price_range || 2, featured: p.featured || false, verified: p.verified || false }); setShowPlaceModal(true); }}
                              className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button onClick={() => deleteItem("place", p.id)}
                              className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--danger)" }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* === CATEGORÍAS TAB === */}
            {placesTab === "categories" && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", slug: "", icon: "", color: "#10A37F", sort_order: categories.length }); setShowCategoryModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Añadir categoría
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map(c => (
                    <div key={c.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${c.color}18` }}>
                        {c.icon || "📍"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{c.slug}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingCategory(c); setCategoryForm({ name: c.name, slug: c.slug, icon: c.icon, color: c.color, sort_order: c.sort_order }); setShowCategoryModal(true); }}
                          className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => deleteItem("category", c.id)} className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--danger)" }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* === REGLAS IA TAB === */}
            {placesTab === "knowledge" && (
              <>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setEditingRule(null); setRuleForm({ trigger_type: "keyword", trigger_value: "", response: "", priority: 10 }); setShowRuleModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Añadir regla
                  </button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {knowledgeRules.map(r => (
                    <div key={r.id} className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                              {r.trigger_type}
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
                              "{r.trigger_value}"
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>prioridad {r.priority}</span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.response}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditingRule(r); setRuleForm({ trigger_type: r.trigger_type, trigger_value: r.trigger_value, response: r.response, priority: r.priority }); setShowRuleModal(true); }}
                            className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => deleteItem("knowledge-rule", r.id)} className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--danger)" }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {knowledgeRules.length === 0 && (
                    <div className="text-center py-16">
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Sin reglas todavía</p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Las reglas de conocimiento se inyectan al prompt de la IA automáticamente</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* === SUBMISSIONS TAB (knowledge pending) === */}
            {placesTab === "submissions" && (
              <>
                <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Los pendientes son entradas en la base de datos de conocimiento que aún no están activas. Apruébalas para que aparezcan en las respuestas de la IA o recházalas para eliminarlas.
                  </p>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {knowledge.filter(k => k.status !== "approved").length === 0 && knowledge.filter(k => k.status === "approved").length === 0 && (
                    <div className="text-center py-16">
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Sin entradas de conocimiento</p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>La base de conocimiento está vacía. Usa el VPS para investigar y guardar.</p>
                    </div>
                  )}

                  {/* Pending */}
                  {knowledge.filter(k => k.status === "pending").length > 0 && (
                    <>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--warning)" }}>Pendientes ({knowledge.filter(k => k.status === "pending").length})</p>
                      {knowledge.filter(k => k.status === "pending").map(k => (
                        <div key={k.id} className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start gap-3">
                            <div className="flex-[private model]in-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {k.city && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>{k.city}</span>}
                                {k.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>{k.category}</span>}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>pending</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(100,100,100,0.12)", color: "var(--text-tertiary)" }}>{k.source || "manual"}</span>
                              </div>
                              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>{k.query}</p>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{k.content?.slice(0, 200)}{k.content?.length > 200 ? "..." : ""}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setActionLoading(k.id + "-approve"); adminFetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, status: "approved" }) }).then(() => { setKnowledge(prev => prev.map(x => x.id === k.id ? { ...x, status: "approved" } : x)); setActionLoading(null); showToast("success", "Aprobado"); }).catch(() => { setActionLoading(null); showToast("error", "Error al aprobar"); }); }}
                                disabled={actionLoading === k.id + "-approve"} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "var(--primary)", color: "white" }}>
                                Aprobar
                              </button>
                              <button onClick={() => { setActionLoading(k.id + "-reject"); adminFetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, status: "rejected" }) }).then(() => { setKnowledge(prev => prev.map(x => x.id === k.id ? { ...x, status: "rejected" } : x)); setActionLoading(null); showToast("success", "Rechazado"); }).catch(() => { setActionLoading(null); showToast("error", "Error al rechazar"); }); }}
                                disabled={actionLoading === k.id + "-reject"} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "var(--danger)", color: "white" }}>
                                Rechazar
                              </button>
                              <button onClick={() => { if (confirm("¿Eliminar permanentemente?")) { adminFetch(`/api/admin/knowledge?id=${k.id}`, { method: "DELETE" }).then(() => { setKnowledge(prev => prev.filter(x => x.id !== k.id)); showToast("success", "Eliminado"); }).catch(() => showToast("error", "Error al eliminar")); } }}
                                className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--danger)" }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Rejected */}
                  {knowledge.filter(k => k.status === "rejected").length > 0 && (
                    <>
                      <p className="text-xs font-semibold mb-2 mt-4" style={{ color: "var(--danger)" }}>Rechazados ({knowledge.filter(k => k.status === "rejected").length})</p>
                      {knowledge.filter(k => k.status === "rejected").map(k => (
                        <div key={k.id} className="rounded-2xl p-4 opacity-50" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {k.city && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>{k.city}</span>}
                                {k.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>{k.category}</span>}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>rejected</span>
                              </div>
                              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{k.query}</p>
                            </div>
                            <button onClick={() => { setActionLoading(k.id + "-restore"); adminFetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, status: "pending" }) }).then(() => { setKnowledge(prev => prev.map(x => x.id === k.id ? { ...x, status: "pending" } : x)); setActionLoading(null); showToast("success", "Restaurado a pendiente"); }).catch(() => { setActionLoading(null); showToast("error", "Error"); }); }}
                              disabled={actionLoading === k.id + "-restore"} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "var(--warning)", color: "white" }}>
                              Restaurar
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Approved */}
                  {knowledge.filter(k => k.status === "approved").length > 0 && (
                    <>
                      <p className="text-xs font-semibold mb-2 mt-4" style={{ color: "var(--primary)" }}>Aprobados ({knowledge.filter(k => k.status === "approved").length})</p>
                      {knowledge.filter(k => k.status === "approved").map(k => (
                        <div key={k.id} className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start gap-3">
                            <div className="flex-[private model]in-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {k.city && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>{k.city}</span>}
                                {k.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>{k.category}</span>}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>approved</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(100,100,100,0.12)", color: "var(--text-tertiary)" }}>{k.source || "manual"}</span>
                              </div>
                              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>{k.query}</p>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{k.content?.slice(0, 150)}{k.content?.length > 150 ? "..." : ""}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { if (confirm("¿Desactivar esta entrada?")) { adminFetch("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id, status: "pending" }) }).then(() => { setKnowledge(prev => prev.map(x => x.id === k.id ? { ...x, status: "pending" } : x)); showToast("success", "Desactivado"); }).catch(() => showToast("error", "Error")); } }}
                                className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--warning)" }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                              <button onClick={() => { if (confirm("¿Eliminar permanentemente?")) { adminFetch(`/api/admin/knowledge?id=${k.id}`, { method: "DELETE" }).then(() => { setKnowledge(prev => prev.filter(x => x.id !== k.id)); showToast("success", "Eliminado"); }).catch(() => showToast("error", "Error al eliminar")); } }}
                                className="p-2 rounded-xl transition-all hover:opacity-80" style={{ color: "var(--danger)" }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Modals */}
        {showPlaceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowPlaceModal(false); }}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-base font-bold mb-5" style={{ color: "var(--text-primary)" }}>{editingPlace ? "Editar lugar" : "Nuevo lugar"}</h3>
              <div className="space-y-4">
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Nombre *</label>
                  <input value={placeForm.name} onChange={e => setPlaceForm({ ...placeForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ciudad *</label>
                    <select value={placeForm.city_id} onChange={e => setPlaceForm({ ...placeForm, city_id: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <option value="">Seleccionar...</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Categoría *</label>
                    <select value={placeForm.category_id} onChange={e => setPlaceForm({ ...placeForm, category_id: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <option value="">Seleccionar...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select></div>
                </div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Especialidad</label>
                  <input value={placeForm.specialty} onChange={e => setPlaceForm({ ...placeForm, specialty: e.target.value })} placeholder="ej: empanadas, pizza, comida rápida..." className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Dirección</label>
                  <input value={placeForm.address} onChange={e => setPlaceForm({ ...placeForm, address: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Teléfono</label>
                    <input value={placeForm.phone} onChange={e => setPlaceForm({ ...placeForm, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>WhatsApp</label>
                    <input value={placeForm.whatsapp} onChange={e => setPlaceForm({ ...placeForm, whatsapp: e.target.value })} placeholder="0412..." className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                </div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Google Maps URL</label>
                  <input value={placeForm.google_maps_url} onChange={e => setPlaceForm({ ...placeForm, google_maps_url: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Waze URL</label>
                  <input value={placeForm.waze_url} onChange={e => setPlaceForm({ ...placeForm, waze_url: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Descripción</label>
                  <textarea value={placeForm.description} onChange={e => setPlaceForm({ ...placeForm, description: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={placeForm.featured} onChange={e => setPlaceForm({ ...placeForm, featured: e.target.checked })} className="w-4 h-4 rounded" />
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Destacado</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={placeForm.verified} onChange={e => setPlaceForm({ ...placeForm, verified: e.target.checked })} className="w-4 h-4 rounded" />
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Verificado</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowPlaceModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium transition-all" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Cancelar</button>
                <button onClick={savePlace} disabled={!placeForm.name || !placeForm.city_id || !placeForm.category_id}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                  {editingPlace ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowCategoryModal(false); }}>
            <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-base font-bold mb-5" style={{ color: "var(--text-primary)" }}>{editingCategory ? "Editar categoría" : "Nueva categoría"}</h3>
              <div className="space-y-4">
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                  <input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ícono (emoji)</label>
                    <input value={categoryForm.icon} onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none text-center text-xl" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Color (hex)</label>
                    <input value={categoryForm.color} onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowCategoryModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Cancelar</button>
                <button onClick={saveCategory} disabled={!categoryForm.name}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                  {editingCategory ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowRuleModal(false); }}>
            <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-base font-bold mb-5" style={{ color: "var(--text-primary)" }}>{editingRule ? "Editar regla" : "Nueva regla de conocimiento"}</h3>
              <div className="space-y-4">
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Tipo de trigger</label>
                  <select value={ruleForm.trigger_type} onChange={e => setRuleForm({ ...ruleForm, trigger_type: e.target.value })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <option value="keyword">Palabra clave</option>
                    <option value="category">Categoría</option>
                    <option value="city">Ciudad</option>
                  </select></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Valor (qué hace match)</label>
                  <input value={ruleForm.trigger_value} onChange={e => setRuleForm({ ...ruleForm, trigger_value: e.target.value })} placeholder="ej: quién es Mulfai, qué es esto..." className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Respuesta que debe dar la IA</label>
                  <textarea value={ruleForm.response} onChange={e => setRuleForm({ ...ruleForm, response: e.target.value })} rows={4} placeholder="La respuesta que quieres que la IA dé cuando detecte este trigger..." className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Prioridad (1-100, mayor = más importante)</label>
                  <input type="number" min="1" max="100" value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 10 })} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} /></div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowRuleModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Cancelar</button>
                <button onClick={saveRule} disabled={!ruleForm.trigger_value || !ruleForm.response}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                  {editingRule ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
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