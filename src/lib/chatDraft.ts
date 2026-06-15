// Persistencia de borradores del input del chat (por conversación). Un
// borrador deja que un mensaje a medio escribir sobreviva a la navegación o
// a un reload. Se indexa por conversación; el empty state ("conversación
// nueva", sin id todavía) comparte una sola clave "new".
//
// OJO — vive en su PROPIO módulo (no dentro de ChatInput) a propósito: cuando
// se envía el PRIMER mensaje de una conversación nueva, el convId cambia
// (null → id nuevo) ANTES de que el input se limpie. Si solo confiáramos en
// el efecto de guardado de ChatInput, el "" se escribiría bajo la clave de la
// conversación NUEVA y el borrador donde de verdad se escribió el texto
// (clave "new") quedaría HUÉRFANO — y reaparecería en el siguiente chat nuevo
// ("la pregunta se queda guardada en el input aunque ya la hayas hecho"). Por
// eso el camino de envío (ChatInterface.sendMessage) limpia el borrador de la
// conversación de ORIGEN explícitamente con clearDraft().

const DRAFT_KEY = (convId: string | null | undefined) =>
  `vechat:draft:${convId ?? "new"}`;
export const DRAFT_SAVE_DEBOUNCE_MS = 400;
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días — borradores más viejos se ignoran

type StoredDraft = { v: string; t: number };

export function readDraft(convId: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(DRAFT_KEY(convId));
    if (!raw) return "";
    const parsed = JSON.parse(raw) as StoredDraft;
    if (typeof parsed?.v !== "string") return "";
    if (typeof parsed?.t !== "number") return parsed.v;
    if (Date.now() - parsed.t > MAX_DRAFT_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY(convId));
      return "";
    }
    return parsed.v;
  } catch {
    return "";
  }
}

export function writeDraft(convId: string | null | undefined, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      localStorage.removeItem(DRAFT_KEY(convId));
      return;
    }
    const payload: StoredDraft = { v: value, t: Date.now() };
    localStorage.setItem(DRAFT_KEY(convId), JSON.stringify(payload));
  } catch {
    // Cuota llena o modo privado — se ignora, el borrador simplemente no persiste.
  }
}

export function clearDraft(convId: string | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY(convId));
  } catch {}
}
