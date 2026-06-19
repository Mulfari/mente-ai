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

/**
 * Normaliza un número venezolano a formato internacional para wa.me
 * ("04141234567" -> "584141234567"; "+58 414-123 4567" -> "584141234567").
 */
export function waLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  let d = whatsapp.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "58" + d.slice(1);
  else if (!d.startsWith("58")) d = "58" + d;
  return `https://wa.me/${d}`;
}

/**
 * Busca negocios de VeLocal por término + ciudad. Esquema ACTUAL: match por
 * ilike sobre name/description/category (la categoría es texto libre). Cuando
 * VeLocal agregue tags/lat/lng/visible_in_vechat, se enchufan aquí (ver spec,
 * "Task 2b") sin cambiar la firma. Degrada con gracia: cualquier error → [].
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
  // Sanitiza para el filtro .or de PostgREST (sin comas/paréntesis/% que rompen
  // la sintaxis del filtro). El término viene de un único token, así que basta.
  const safe = term.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  if (!safe) return [];
  const limit = opts.limit ?? 5;

  try {
    const supabase = createClient();
    let q = supabase
      .from("velocal_businesses")
      .select("slug,name,category,city,description,whatsapp,instagram,maps_url,logo_url,hours")
      .eq("active", true)
      .or(`name.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`)
      .limit(limit * 4);
    if (opts.city && opts.city.trim()) q = q.ilike("city", opts.city.trim());

    const { data, error } = await q;
    if (error || !data) return [];

    const rows: LocalBusiness[] = data.map((b: Record<string, unknown>) => ({
      slug: b.slug as string,
      name: b.name as string,
      category: (b.category as string) ?? null,
      city: (b.city as string) ?? null,
      description: (b.description as string) ?? null,
      whatsapp: (b.whatsapp as string) ?? null,
      instagram: (b.instagram as string) ?? null,
      mapsUrl: (b.maps_url as string) ?? null,
      logoUrl: (b.logo_url as string) ?? null,
      hours: (b.hours as Hours) ?? null,
      openNow: isOpenNow(b.hours as Hours),
    }));

    // Ranking v1 (los datos aún no tienen lat/lng): abiertos primero. La
    // distancia (haversine con opts.lat/lng) se enchufa en Task 2b.
    rows.sort((a, b) => Number(b.openNow) - Number(a.openNow));
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}
