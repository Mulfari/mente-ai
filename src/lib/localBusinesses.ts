// src/lib/localBusinesses.ts
// Capa de recuperación de negocios de VeLocal para el descubrimiento en VeChat.
// Lee la tabla COMPARTIDA `velocal_businesses` (solo lectura, service role).
// Reusable hoy (grounding en /api/web-context) y mañana (tool-calling).
// Spec: docs/superpowers/specs/2026-06-19-velocal-en-vechat-design.md

export type Hours = Record<string, [string, string][]>;

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
