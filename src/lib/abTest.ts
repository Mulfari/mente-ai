// A/B de respuestas: en una fracción de turnos LOGUEADOS generamos DOS variantes
// (A = estilo normal, B = más conciso) sobre la MISMA pregunta aterrizada, y el
// usuario elige. El % de victoria (admin) dice qué estilo conviene por defecto.
// ChatGPT usa su A/B para reentrenar su modelo; nosotros no podemos reentrenar
// MiniMax, así que comparamos ESTILO → dato accionable para el prompt. Lógica
// pura (testeable); el render + las llamadas viven en ChatInterface.

export const AB_SAMPLE_RATE = 0.12; // ~12% de turnos logueados
export const VARIANT_A = "normal";
export const VARIANT_B = "conciso";

// Instrucción que diferencia la variante B. Se anexa a la pregunta YA aterrizada
// (ambas variantes comparten la misma info → comparamos estilo, no contenido).
export const VARIANT_B_INSTRUCTION =
  "\n\n[Formato: responde de forma MÁS BREVE y directa que de costumbre, sin perder lo esencial.]";

// PURO: ¿este turno muestra A/B? Solo logueados, muestreo aleatorio.
export function shouldShowAB(rand: number, isLoggedIn: boolean): boolean {
  return isLoggedIn && rand < AB_SAMPLE_RATE;
}

// PURO: etiqueta de la variante ganadora a partir de la elección.
export function winnerLabel(chosen: "a" | "b"): string {
  return chosen === "a" ? VARIANT_A : VARIANT_B;
}
