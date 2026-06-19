// src/lib/phone.ts — helpers PUROS de teléfono (server + cliente, sin deps).

/**
 * Normaliza un número venezolano a un enlace wa.me en formato internacional
 * ("04141234567" -> "https://wa.me/584141234567"; "+58 414-123 4567" igual).
 * Devuelve null si no hay dígitos.
 */
export function waLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  let d = whatsapp.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "58" + d.slice(1);
  else if (!d.startsWith("58")) d = "58" + d;
  return `https://wa.me/${d}`;
}
