// Historial de conversaciones para visitantes SIN cuenta — vive en localStorage.
// Tope 3 conversaciones; cada una caduca a los 3 días (se podan al leer). No hay
// usuario registrado detrás, así que nada de esto toca la base de datos.

export type AnonMessage = {
  id: string;
  role: string;
  content: string;
  created_at?: string;
  [k: string]: unknown;
};

export type AnonConv = {
  id: string;
  title: string;
  messages: AnonMessage[];
  updatedAt: number;
};

const KEY = "vechat-anon-convs";
const MAX = 3;
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

function readAll(): AnonConv[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: AnonConv[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* cuota llena / modo privado: best-effort */
  }
}

// Lista las conversaciones vivas (≤3 días), más recientes primero, máx 3.
// De paso PODA las caducadas y el exceso (persiste la limpieza).
export function listAnonConvs(): AnonConv[] {
  const now = Date.now();
  const fresh = readAll()
    .filter((c) => c && c.id && now - (c.updatedAt || 0) < TTL_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX);
  writeAll(fresh);
  return fresh;
}

// Guarda/actualiza una conversación (la sube al tope, recorta a MAX).
export function saveAnonConv(conv: { id: string; title: string; messages: AnonMessage[] }): AnonConv[] {
  const now = Date.now();
  const rest = readAll().filter((c) => c.id !== conv.id && now - (c.updatedAt || 0) < TTL_MS);
  const next = [{ id: conv.id, title: conv.title, messages: conv.messages, updatedAt: now }, ...rest]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX);
  writeAll(next);
  return next;
}

export function getAnonConv(id: string): AnonConv | null {
  return readAll().find((c) => c.id === id) || null;
}

export function deleteAnonConv(id: string): AnonConv[] {
  const next = readAll().filter((c) => c.id !== id);
  writeAll(next);
  return listAnonConvs();
}

// Borra TODO el historial anónimo (tras migrarlo a la cuenta al loguearse).
export function clearAnonConvs() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* best-effort */ }
}
