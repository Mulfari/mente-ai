"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
};

type Place = {
  id: string;
  name: string;
  address: string;
  description: string;
  specialty: string;
  phone: string;
  whatsapp: string;
  google_maps_url: string;
  waze_url: string;
  hours: any;
  price_range: number;
  rating: number;
  featured: boolean;
  cities: { name: string; slug: string };
  categories: { name: string; slug: string; icon: string; color: string };
};

export default function ExplorePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const [catRes, placesRes] = await Promise.all([
        fetch("/api/admin/places?type=categories"),
        fetch("/api/admin/places?type=places"),
      ]);
      const [catData, placesData] = await Promise.all([catRes.json(), placesRes.json()]);
      setCategories(catData.data || []);
      setPlaces(placesData.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const filtered = places.filter(p => {
    const matchesCategory = !selectedCategory || p.categories?.slug === selectedCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.specialty || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function formatHours(hours: any): string {
    if (!hours) return "";
    const days = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
    return Object.entries(hours).map(([d, t]: [any, any]) => `${days[parseInt(d)] || d}: ${t || "cerrado"}`).join(" · ");
  }

  function priceRange(n: number) {
    return Array.from({ length: 4 }, (_, i) => i < (n || 0) ? "var(--warning)" : "var(--border)").map((c, i) => (
      <span key={i} className="inline-block w-3 h-3 rounded-full mr-0.5" style={{ backgroundColor: c as any }} />
    ));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
          <span className="text-sm">Cargando directorio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-4 border-b shrink-0"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/" className="shrink-0 p-2 rounded-xl transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Local</span>
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar restaurantes, farmacias..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              backgroundColor: !selectedCategory ? "var(--primary)" : "var(--surface)",
              color: !selectedCategory ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}>
            Todos
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.slug)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                backgroundColor: selectedCategory === c.slug ? c.color : "var(--surface)",
                color: selectedCategory === c.slug ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}>
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>

        {/* Places count */}
        <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
          {filtered.length} lugar{filtered.length !== 1 ? "es" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Places list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "var(--surface)" }}>
              <svg className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No hay lugares</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Aún no hay lugares en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id}
                className="rounded-2xl p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                onClick={() => {}}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `${p.categories?.color || "var(--primary)"}18` }}>
                    {p.categories?.icon || "📍"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                      {p.featured && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>
                          Destacado
                        </span>
                      )}
                    </div>
                    {p.specialty && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{p.specialty}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {priceRange(p.price_range)}
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {p.description}
                  </p>
                )}

                <div className="space-y-1.5">
                  {p.address && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.address}</p>
                    </div>
                  )}
                  {p.hours && Object.keys(p.hours).length > 0 && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatHours(p.hours)}</p>
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <a href={`tel:${p.phone}`} className="text-xs hover:underline" style={{ color: "var(--primary)" }}>
                        {p.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4">
                  {p.google_maps_url && (
                    <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                      style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      Maps
                    </a>
                  )}
                  {p.waze_url && (
                    <a href={p.waze_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                      style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z"/>
                      </svg>
                      Waze
                    </a>
                  )}
                  {p.whatsapp && (
                    <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                      style={{ backgroundColor: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)" }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.447 1.088h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}