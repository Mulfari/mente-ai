// src/lib/localBusinesses.ts
// Capa de recuperación de negocios de VeLocal para el descubrimiento en VeChat.
// Lee la tabla COMPARTIDA `velocal_businesses` (solo lectura, service role).
// Reusable hoy (grounding en /api/web-context) y mañana (tool-calling).
// Spec: docs/superpowers/specs/2026-06-19-velocal-en-vechat-design.md

import { createClient } from "@/lib/supabase/server";

export type Hours = Record<string, [string, string][]>;

export type LocalBusiness = {
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  neighborhood: string | null;
  description: string | null;
  whatsapp: string | null;
  instagram: string | null;
  mapsUrl: string | null;
  logoUrl: string | null;
  hours: Hours | null;
  openNow: boolean;
  distanceKm?: number;
};

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMin = (s: string): number => {
  const [h, m] = (s || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * ¿El negocio está abierto AHORA, en hora de Venezuela (UTC-4, sin horario de
 * verano)? Respeta rangos que cruzan medianoche (p. ej. ["17:00","00:30"]): el
 * tramo después de medianoche pertenece al día SIGUIENTE, así que se evalúa como
 * "cola de ayer", no como parte de hoy.
 */
export function isOpenNow(hours: Hours | null | undefined, now: Date = new Date()): boolean {
  if (!hours) return false;
  const ve = new Date(now.getTime() - 4 * 3600 * 1000); // UTC-4
  const day = ve.getUTCDay();
  const mins = ve.getUTCHours() * 60 + ve.getUTCMinutes();
  // Rangos de HOY. Normal: [A,B). Si cruza medianoche (B<=A), hoy cubre solo
  // [A, fin de día); el tramo [0,B) es de mañana, no de hoy.
  const today = hours[DAYS[day]] ?? [];
  const openToday = today.some(([a, b]) => {
    const A = toMin(a), B = toMin(b);
    return B > A ? mins >= A && mins < B : mins >= A;
  });
  if (openToday) return true;
  // Cola de AYER que cruzó medianoche → cubre la madrugada de hoy [0,B).
  const yest = hours[DAYS[(day + 6) % 7]] ?? [];
  return yest.some(([a, b]) => {
    const A = toMin(a), B = toMin(b);
    return B <= A && B > 0 && mins < B;
  });
}

/** Distancia en km entre dos coordenadas (haversine). */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLng = (bLng - aLng) * d;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Busca negocios de VeLocal por término + (ubicación | ciudad). Usa la columna
 * GENERADA `search_tsv` (tsvector español, unaccent-aware, incluye tags) — NO
 * construye su propio to_tsvector. Filtra `active` + `visible_in_vechat` y
 * respeta `temporarily_closed`. Con ubicación del usuario → ranking por
 * DISTANCIA (cercanos primero); sin ella → ciudad + abiertos primero. Degrada
 * con gracia: cualquier error → [].
 */
export async function searchLocalBusinesses(opts: {
  city?: string | null;
  term: string;
  lat?: number | null;
  lng?: number | null;
  limit?: number;
}): Promise<LocalBusiness[]> {
  const term = (opts.term || "").trim();
  if (!term) return [];
  // Limpia el término para plainto_tsquery (deja letras/números/espacios).
  const safe = term.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  if (!safe) return [];
  const limit = opts.limit ?? 5;
  const hasLoc = typeof opts.lat === "number" && typeof opts.lng === "number";

  try {
    const supabase = createClient();
    let q = supabase
      .from("velocal_businesses")
      .select("slug,name,category,city,neighborhood,description,whatsapp,instagram,maps_url,logo_url,hours,lat,lng,temporarily_closed")
      .eq("active", true)
      .eq("visible_in_vechat", true)
      .textSearch("search_tsv", safe, { type: "plain", config: "spanish" })
      .limit(Math.max(limit * 4, 20));
    // Sin ubicación, acota a la ciudad del usuario; con ubicación manda la distancia.
    if (!hasLoc && opts.city && opts.city.trim()) q = q.ilike("city", opts.city.trim());

    const { data, error } = await q;
    if (error || !data) return [];

    const rows: LocalBusiness[] = data.map((b: Record<string, unknown>) => {
      const lat = typeof b.lat === "number" ? (b.lat as number) : null;
      const lng = typeof b.lng === "number" ? (b.lng as number) : null;
      const distanceKm = hasLoc && lat != null && lng != null
        ? haversineKm(opts.lat as number, opts.lng as number, lat, lng)
        : undefined;
      return {
        slug: b.slug as string,
        name: b.name as string,
        category: (b.category as string) ?? null,
        city: (b.city as string) ?? null,
        neighborhood: (b.neighborhood as string) ?? null,
        description: (b.description as string) ?? null,
        whatsapp: (b.whatsapp as string) ?? null,
        instagram: (b.instagram as string) ?? null,
        mapsUrl: (b.maps_url as string) ?? null,
        logoUrl: (b.logo_url as string) ?? null,
        hours: (b.hours as Hours) ?? null,
        openNow: b.temporarily_closed ? false : isOpenNow(b.hours as Hours),
        ...(distanceKm != null ? { distanceKm } : {}),
      };
    });

    if (hasLoc) {
      // Cercanos primero; los sin coordenadas al final; desempate por abiertos.
      rows.sort((a, b) => {
        const da = a.distanceKm ?? Infinity, db = b.distanceKm ?? Infinity;
        if (da !== db) return da - db;
        return Number(b.openNow) - Number(a.openNow);
      });
    } else {
      rows.sort((a, b) => Number(b.openNow) - Number(a.openNow));
    }
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Registra una SEÑAL DE DEMANDA: alguien pidió algo local con intención de
 * consumo (categoría + ciudad) que NO tenemos en VeLocal. Alimenta el panel
 * "Lo más pedido sin cobertura" del admin → la lista de a quién reclutar.
 * Best-effort: jamás debe romper la respuesta del chat.
 */
export async function logDemand(opts: {
  city?: string | null;
  term: string;
  query?: string | null;
  clerkUserId?: string | null;
}): Promise<void> {
  try {
    const term = (opts.term || "").trim().toLowerCase();
    if (!term) return;
    const supabase = createClient();
    await supabase.from("demand_signals").insert({
      city: opts.city?.trim() || null,
      term,
      query: (opts.query || "").slice(0, 500) || null,
      clerk_user_id: opts.clerkUserId ?? null,
    });
  } catch {
    // best-effort
  }
}
